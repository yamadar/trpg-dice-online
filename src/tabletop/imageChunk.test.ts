import { describe, it, expect } from 'vitest'
import {
  ChunkBuffer,
  chunkString,
  reassembleChunks,
} from './imageChunk'

describe('chunkString', () => {
  it('splits a string into the announced number of chunks', () => {
    const { spec, chunks } = chunkString('m1', 'abcdefghij', 4)
    expect(spec).toEqual({ id: 'm1', total: 10, count: 3 })
    expect(chunks).toEqual([
      { id: 'm1', seq: 0, data: 'abcd' },
      { id: 'm1', seq: 1, data: 'efgh' },
      { id: 'm1', seq: 2, data: 'ij' },
    ])
  })

  it('emits exactly one empty chunk for an empty source', () => {
    const { spec, chunks } = chunkString('m1', '', 4)
    expect(spec).toEqual({ id: 'm1', total: 0, count: 1 })
    expect(chunks).toEqual([{ id: 'm1', seq: 0, data: '' }])
  })

  it('round-trips through reassembleChunks', () => {
    const source =
      'data:image/png;base64,' + 'A'.repeat(1000) + 'B'.repeat(1234)
    const { spec, chunks } = chunkString('m1', source, 128)
    expect(reassembleChunks(spec, chunks)).toBe(source)
  })

  it('rejects a non-positive chunk size', () => {
    expect(() => chunkString('m1', 'x', 0)).toThrow()
    expect(() => chunkString('m1', 'x', -1)).toThrow()
  })
})

describe('ChunkBuffer', () => {
  it('reports progress as chunks arrive', () => {
    const { spec, chunks } = chunkString('m1', 'abcdefgh', 2)
    const buf = new ChunkBuffer(spec)
    expect(buf.progress).toBe(0)
    buf.add(chunks[0])
    expect(buf.progress).toBe(0.25)
    buf.add(chunks[1])
    expect(buf.progress).toBe(0.5)
    buf.add(chunks[2])
    buf.add(chunks[3])
    expect(buf.isComplete).toBe(true)
    expect(buf.reassemble()).toBe('abcdefgh')
  })

  it('accepts out-of-order chunks', () => {
    const { spec, chunks } = chunkString('m1', 'helloworld', 3)
    const buf = new ChunkBuffer(spec)
    buf.add(chunks[3])
    buf.add(chunks[1])
    buf.add(chunks[0])
    expect(buf.isComplete).toBe(false)
    buf.add(chunks[2])
    expect(buf.isComplete).toBe(true)
    expect(buf.reassemble()).toBe('helloworld')
  })

  it('drops duplicate chunks without overcounting', () => {
    const { spec, chunks } = chunkString('m1', 'abcd', 2)
    const buf = new ChunkBuffer(spec)
    buf.add(chunks[0])
    buf.add(chunks[0])
    expect(buf.progress).toBe(0.5)
    buf.add(chunks[1])
    expect(buf.reassemble()).toBe('abcd')
  })

  it('drops chunks that belong to a different transfer', () => {
    const { spec, chunks } = chunkString('m1', 'abcd', 2)
    const otherChunk = { id: 'm2', seq: 0, data: 'XX' }
    const buf = new ChunkBuffer(spec)
    buf.add(otherChunk)
    expect(buf.progress).toBe(0)
    for (const chunk of chunks) buf.add(chunk)
    expect(buf.reassemble()).toBe('abcd')
  })

  it('rejects out-of-range chunk indices', () => {
    const { spec, chunks } = chunkString('m1', 'abcd', 2)
    const buf = new ChunkBuffer(spec)
    buf.add({ id: 'm1', seq: -1, data: 'X' })
    buf.add({ id: 'm1', seq: 999, data: 'X' })
    expect(buf.progress).toBe(0)
    for (const chunk of chunks) buf.add(chunk)
    expect(buf.reassemble()).toBe('abcd')
  })

  it('returns null before completion and after a length mismatch', () => {
    const { spec, chunks } = chunkString('m1', 'abcdefgh', 2)
    const buf = new ChunkBuffer(spec)
    expect(buf.reassemble()).toBeNull()
    for (const chunk of chunks) buf.add(chunk)
    expect(buf.reassemble()).toBe('abcdefgh')
  })

  it('detects a tampered total mismatch', () => {
    const { spec, chunks } = chunkString('m1', 'abcdefgh', 4)
    const tamperedSpec = { ...spec, total: 100 }
    expect(reassembleChunks(tamperedSpec, chunks)).toBeNull()
  })

  it('rejects a non-positive chunk count', () => {
    expect(() => new ChunkBuffer({ id: 'm1', total: 0, count: 0 })).toThrow()
  })
})
