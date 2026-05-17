import { Peer, type DataConnection } from 'peerjs'
import {
  generateRoomCode,
  peerIdForCode,
  type ClientMessage,
  type HostMessage,
} from './protocol'

export type RoomStatus = 'offline' | 'connecting' | 'connected' | 'error'

export interface RoomCallbacks {
  onStatus: (status: RoomStatus) => void
  /** Host side: a message arrived from a client. */
  onClientMessage: (peerId: string, msg: ClientMessage) => void
  /** Host side: a client connection closed. */
  onClientDisconnect: (peerId: string) => void
  /** Client side: a message arrived from the host. */
  onHostMessage: (msg: HostMessage) => void
  /** Connection failed or the host was lost. */
  onError: (kind: 'connect' | 'hostLost') => void
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
  private readonly cb: RoomCallbacks

  constructor(cb: RoomCallbacks) {
    this.cb = cb
  }

  get isActive(): boolean {
    return this.role !== null
  }

  /** Create a room and return its code. Retries on room-code collision. */
  async host(): Promise<string> {
    this.cb.onStatus('connecting')
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
      const peer = new Peer(peerIdForCode(code))
      let settled = false

      peer.on('open', () => {
        settled = true
        this.peer = peer
        peer.on('connection', (conn) => this.registerClientConnection(conn))
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
    this.cb.onStatus('connecting')
    return new Promise<void>((resolve, reject) => {
      const peer = new Peer()
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
          this.cb.onStatus('connected')
          resolve()
        })
        conn.on('data', (data) => {
          this.cb.onHostMessage(data as HostMessage)
        })
        conn.on('close', () => {
          if (settled) this.cb.onError('hostLost')
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

  /** Tear down all connections and the peer. */
  close(): void {
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
