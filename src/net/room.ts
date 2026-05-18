import { Peer, type DataConnection } from 'peerjs'
import {
  generateRoomCode,
  peerIdForCode,
  type ClientMessage,
  type HostMessage,
} from './protocol'
import { peerConfig } from './ice'

export type RoomStatus = 'offline' | 'connecting' | 'connected' | 'error'

export interface RoomCallbacks {
  onStatus: (status: RoomStatus) => void
  /** Host side: a message arrived from a client. */
  onClientMessage: (peerId: string, msg: ClientMessage) => void
  /** Host side: a client connection closed. */
  onClientDisconnect: (peerId: string) => void
  /** Client side: a message arrived from the host. */
  onHostMessage: (msg: HostMessage) => void
  /**
   * Connection trouble:
   * - `connect`  : an initial join attempt failed.
   * - `hostLost` : a client lost its link to the host.
   * - `peerLost` : a host lost its own peer (e.g. the tab was suspended).
   */
  onError: (kind: 'connect' | 'hostLost' | 'peerLost') => void
}

const CONNECT_TIMEOUT_MS = 12000
const MAX_HOST_RETRIES = 5

/**
 * PeerJS transport for a star-topology room: the host (GM) is the hub,
 * every client connects directly to it. This class is transport-only —
 * all game-state decisions live in the session layer.
 */
export class RoomManager {
  private peer: Peer | null = null
  private role: 'host' | 'client' | null = null
  /** Host: open client connections keyed by peer id. */
  private connections = new Map<string, DataConnection>()
  /** Client: the single connection to the host. */
  private hostConn: DataConnection | null = null
  /** True while close() is tearing down, so drops are not reported. */
  private closing = false
  /** Host: a peer opened for a pending room-code change, awaiting commit. */
  private candidatePeer: Peer | null = null
  /** Host: client peer ids on the old peer when a code change was prepared. */
  private preMigrationKeys: string[] = []
  private readonly cb: RoomCallbacks

  constructor(cb: RoomCallbacks) {
    this.cb = cb
  }

  get isActive(): boolean {
    return this.role !== null
  }

  /**
   * Create a room and return its code.
   * - With `preferredCode`, host exactly that code; a collision rejects
   *   with `'unavailable-id'` so the caller can report it.
   * - Without one, a random code is used, retrying on the rare collision.
   */
  async host(preferredCode?: string): Promise<string> {
    this.closing = false
    this.cb.onStatus('connecting')
    if (preferredCode) {
      try {
        await this.openHostPeer(preferredCode)
        this.role = 'host'
        this.cb.onStatus('connected')
        return preferredCode
      } catch (err) {
        this.cb.onStatus('error')
        throw err
      }
    }
    for (let attempt = 0; attempt < MAX_HOST_RETRIES; attempt++) {
      const code = generateRoomCode()
      try {
        await this.openHostPeer(code)
        this.role = 'host'
        this.cb.onStatus('connected')
        return code
      } catch (err) {
        if (err === 'unavailable-id') continue
        this.cb.onStatus('error')
        throw err
      }
    }
    this.cb.onStatus('error')
    throw new Error('Could not allocate a room code')
  }

  private openHostPeer(code: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const peer = new Peer(peerIdForCode(code), { config: peerConfig })
      let settled = false

      peer.on('open', () => {
        settled = true
        this.peer = peer
        peer.on('connection', (conn) => this.registerClientConnection(conn))
        this.watchPeer(peer, 'peerLost')
        resolve()
      })

      peer.on('error', (err: Error & { type?: string }) => {
        if (!settled) {
          peer.destroy()
          reject(err.type ?? err)
        }
      })
    })
  }

  /**
   * After a peer is open, keep it healthy: a lost signaling socket (the
   * common result of a phone backgrounding the tab) is recovered in place
   * via reconnect(), which keeps the same peer id. A peer that closes for
   * good is reported so the session can rebuild the room.
   */
  private watchPeer(peer: Peer, lostKind: 'hostLost' | 'peerLost'): void {
    // The `peer === this.peer` guard ignores a peer that has been swapped
    // out (e.g. the old peer destroyed by a deliberate room-code change),
    // so its teardown is not mistaken for an unexpected disconnect.
    peer.on('disconnected', () => {
      if (!this.closing && peer === this.peer && !peer.destroyed) {
        try {
          peer.reconnect()
        } catch {
          /* already reconnecting */
        }
      }
    })
    peer.on('close', () => {
      if (!this.closing && peer === this.peer) this.cb.onError(lostKind)
    })
  }

  private registerClientConnection(conn: DataConnection): void {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn)
    })
    conn.on('data', (data) => {
      this.cb.onClientMessage(conn.peer, data as ClientMessage)
    })
    const drop = () => {
      if (this.connections.delete(conn.peer)) {
        this.cb.onClientDisconnect(conn.peer)
      }
    }
    conn.on('close', drop)
    conn.on('error', drop)
  }

  /** Join an existing room by code. */
  join(code: string): Promise<void> {
    this.closing = false
    this.cb.onStatus('connecting')
    return new Promise<void>((resolve, reject) => {
      const peer = new Peer({ config: peerConfig })
      let settled = false

      const fail = (kind: 'connect' | 'hostLost') => {
        if (settled) return
        settled = true
        this.cb.onStatus('error')
        this.cb.onError(kind)
        peer.destroy()
        reject(new Error(kind))
      }

      const timer = setTimeout(() => fail('connect'), CONNECT_TIMEOUT_MS)

      peer.on('open', () => {
        const conn = peer.connect(peerIdForCode(code), { reliable: true })
        conn.on('open', () => {
          settled = true
          clearTimeout(timer)
          this.peer = peer
          this.hostConn = conn
          this.role = 'client'
          this.watchPeer(peer, 'hostLost')
          this.cb.onStatus('connected')
          resolve()
        })
        conn.on('data', (data) => {
          this.cb.onHostMessage(data as HostMessage)
        })
        conn.on('close', () => {
          if (settled && !this.closing) this.cb.onError('hostLost')
        })
      })

      peer.on('error', (err: Error & { type?: string }) => {
        if (!settled) {
          clearTimeout(timer)
          fail('connect')
        } else if (err.type === 'peer-unavailable' || err.type === 'network') {
          this.cb.onError('hostLost')
        }
      })
    })
  }

  /** Host: send a message to every connected client. */
  broadcast(msg: HostMessage): void {
    for (const conn of this.connections.values()) {
      if (conn.open) conn.send(msg)
    }
  }

  /** Host: send a message to a single client. */
  sendTo(peerId: string, msg: HostMessage): void {
    const conn = this.connections.get(peerId)
    if (conn?.open) conn.send(msg)
  }

  /**
   * Host: forcibly close a client's connection. Closing locally reliably
   * emits 'close', which routes through onClientDisconnect — used to evict
   * a stale ghost when WebRTC never reported the drop on its own.
   */
  dropClient(peerId: string): void {
    this.connections.get(peerId)?.close()
  }

  /** Client: send a message to the host. */
  sendToHost(msg: ClientMessage): void {
    if (this.hostConn?.open) this.hostConn.send(msg)
  }

  /**
   * Host: open a second peer under `code` to prepare a room-code change.
   * It starts accepting connections immediately so migrating clients can
   * join right away. Rejects with `'unavailable-id'` when the code is in
   * use by another room, leaving the current room untouched.
   */
  prepareCodeChange(code: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const candidate = new Peer(peerIdForCode(code), { config: peerConfig })
      let settled = false
      candidate.on('open', () => {
        settled = true
        this.candidatePeer = candidate
        // Snapshot the current (old-peer) clients so commit can drop just
        // them and keep anyone who already migrated to the new peer.
        this.preMigrationKeys = [...this.connections.keys()]
        candidate.on('connection', (conn) => this.registerClientConnection(conn))
        this.watchPeer(candidate, 'peerLost')
        resolve()
      })
      candidate.on('error', (err: Error & { type?: string }) => {
        if (!settled) {
          candidate.destroy()
          reject(err.type ?? err)
        }
      })
    })
  }

  /** Host: switch the live room onto the prepared code, dropping the old peer. */
  commitCodeChange(): void {
    const candidate = this.candidatePeer
    if (!candidate) return
    this.candidatePeer = null
    // Close the old-peer connections ourselves so their async 'close'
    // events are no-ops (already removed) and report no "player left".
    for (const key of this.preMigrationKeys) {
      this.connections.get(key)?.close()
      this.connections.delete(key)
    }
    this.preMigrationKeys = []
    // Promote the candidate before destroying the old peer, so the old
    // peer's 'close' is recognised as a swap-out rather than a loss.
    const oldPeer = this.peer
    this.peer = candidate
    oldPeer?.destroy()
  }

  /** Host: discard a prepared code change without switching over. */
  cancelCodeChange(): void {
    this.candidatePeer?.destroy()
    this.candidatePeer = null
    this.preMigrationKeys = []
  }

  /** Tear down all connections and the peer. */
  close(): void {
    this.closing = true
    this.candidatePeer?.destroy()
    this.candidatePeer = null
    this.preMigrationKeys = []
    for (const conn of this.connections.values()) conn.close()
    this.connections.clear()
    this.hostConn?.close()
    this.hostConn = null
    this.peer?.destroy()
    this.peer = null
    this.role = null
    this.cb.onStatus('offline')
  }
}
