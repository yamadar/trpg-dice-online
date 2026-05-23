/**
 * Chunked transfer of large strings (typically image data URLs) over the
 * P2P channel.
 *
 * PeerJS' SCTP data channel does its own message-level chunking, but the
 * UI wants to know how the transfer is progressing (so a "loading map"
 * indicator can be shown to late joiners), and a single broadcast of a
 * multi-megabyte data URL also blocks the channel for everyone else
 * during that send. Splitting the source into sequenced chunks gives the
 * host enough room to interleave other messages and lets the receiver
 * render progress.
 *
 * The format is intentionally string-in / string-out: callers feed in a
 * data URL (or any other string payload) and get the same string back.
 * Validation of "is this actually an image data URL" lives at the
 * boundary in `../net/protocol.ts`, not here.
 */

/** Default chunk payload size in characters. ~256 KB is a balance
 *  between fewer messages and not blocking the channel for too long
 *  on a single send. */
export const DEFAULT_CHUNK_BYTES = 256 * 1024

export interface ChunkSpec {
  /** Stable id for the transfer (typically `MapBackground.id`). */
  id: string
  /** Total length of the original string in characters. */
  total: number
  /** Number of chunks; always at least 1. */
  count: number
}

export interface Chunk {
  /** Matches `ChunkSpec.id`. */
  id: string
  /** Zero-based chunk index. */
  seq: number
  /** Slice of the original string. */
  data: string
}

export interface ChunkPlan {
  spec: ChunkSpec
  chunks: Chunk[]
}

/**
 * Split a source string into chunks. An empty string still produces one
 * (empty) chunk so the receiver gets a "transfer complete" signal even
 * for an empty payload.
 */
export function chunkString(
  id: string,
  source: string,
  chunkBytes: number = DEFAULT_CHUNK_BYTES,
): ChunkPlan {
  if (chunkBytes <= 0) throw new Error('chunkBytes must be positive')
  const chunks: Chunk[] = []
  for (let i = 0; i < source.length; i += chunkBytes) {
    chunks.push({ id, seq: chunks.length, data: source.slice(i, i + chunkBytes) })
  }
  if (chunks.length === 0) chunks.push({ id, seq: 0, data: '' })
  return {
    spec: { id, total: source.length, count: chunks.length },
    chunks,
  }
}

/**
 * Accumulates chunks for a single transfer. Out-of-order arrivals are
 * fine; duplicates and chunks for a different transfer are dropped
 * silently so a stale broadcast cannot corrupt a fresh one.
 */
export class ChunkBuffer {
  readonly spec: ChunkSpec
  private readonly parts: string[]
  private readonly received: boolean[]
  private receivedCount = 0

  constructor(spec: ChunkSpec) {
    if (spec.count <= 0) throw new Error('ChunkSpec.count must be at least 1')
    this.spec = spec
    this.parts = new Array(spec.count).fill('')
    this.received = new Array(spec.count).fill(false)
  }

  /** Add a chunk to the buffer. Returns true when the transfer completes. */
  add(chunk: Chunk): boolean {
    if (chunk.id !== this.spec.id) return this.isComplete
    if (chunk.seq < 0 || chunk.seq >= this.spec.count) return this.isComplete
    if (this.received[chunk.seq]) return this.isComplete
    this.parts[chunk.seq] = chunk.data
    this.received[chunk.seq] = true
    this.receivedCount += 1
    return this.isComplete
  }

  get isComplete(): boolean {
    return this.receivedCount === this.spec.count
  }

  get progress(): number {
    return this.spec.count === 0 ? 1 : this.receivedCount / this.spec.count
  }

  /**
   * Reassemble the original string. Returns null when the transfer is
   * incomplete, or when the result length does not match the announced
   * total (a signal the spec was lying or the chunks were tampered with).
   */
  reassemble(): string | null {
    if (!this.isComplete) return null
    const result = this.parts.join('')
    return result.length === this.spec.total ? result : null
  }
}

/** Convenience for tests and the in-process round-trip case. */
export function reassembleChunks(spec: ChunkSpec, chunks: Chunk[]): string | null {
  const buf = new ChunkBuffer(spec)
  for (const chunk of chunks) buf.add(chunk)
  return buf.reassemble()
}
