/**
 * WebRTC ICE (STUN / TURN) configuration for the P2P transport.
 *
 * STUN alone only punches through "cone" NATs. Public / café Wi-Fi often
 * uses symmetric NAT — or blocks UDP outright — and then a TURN relay is
 * required: without one, two players behind such networks can exchange a
 * room code but never establish the data channel.
 *
 * The defaults use the Open Relay Project's free public TURN servers
 * (metered.ca). They are offered over ports 80 / 443 and TCP so a network
 * that blocks UDP can still reach the relay. A free shared service is
 * best-effort, so for a dependable relay set the VITE_TURN_* build-time
 * variables to your own TURN server (a free Metered account or a
 * self-hosted coturn) — see .env.example.
 */

/** Build-time variables that point the app at a custom TURN server. */
export interface IceEnv {
  /** Comma-separated TURN URLs, e.g. "turn:host:3478,turns:host:443". */
  VITE_TURN_URLS?: string
  VITE_TURN_USERNAME?: string
  VITE_TURN_CREDENTIAL?: string
}

/** Google's public STUN server — used for the initial candidate gathering. */
const STUN: RTCIceServer = { urls: 'stun:stun.l.google.com:19302' }

/**
 * Open Relay Project free public TURN (no signup). Multiple ports are
 * listed so a network that blocks UDP can still reach the relay over
 * TCP/443, which looks like ordinary HTTPS traffic.
 */
const OPEN_RELAY_TURN: RTCIceServer = {
  urls: [
    'turn:openrelay.metered.ca:80',
    'turn:openrelay.metered.ca:443',
    'turn:openrelay.metered.ca:443?transport=tcp',
  ],
  username: 'openrelayproject',
  credential: 'openrelayproject',
}

/** A TURN entry from VITE_TURN_* env vars, or null when none are set. */
function customTurn(env: IceEnv): RTCIceServer | null {
  const raw = env.VITE_TURN_URLS?.trim()
  if (!raw) return null
  const urls = raw
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
  if (urls.length === 0) return null
  return {
    urls,
    username: env.VITE_TURN_USERNAME ?? '',
    credential: env.VITE_TURN_CREDENTIAL ?? '',
  }
}

/**
 * The ICE server list: always STUN, plus a TURN relay — the custom one
 * from env vars when provided, otherwise the free Open Relay default.
 */
export function buildIceServers(env: IceEnv): RTCIceServer[] {
  return [STUN, customTurn(env) ?? OPEN_RELAY_TURN]
}

/** RTCConfiguration handed to every PeerJS `Peer` created by the app. */
export const peerConfig: RTCConfiguration = {
  iceServers: buildIceServers(import.meta.env as unknown as IceEnv),
}
