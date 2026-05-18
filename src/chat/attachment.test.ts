import { describe, it, expect } from 'vitest'
import { dataUrlBytes, fitWithin, formatBytes, isImageType } from './attachment'

describe('isImageType', () => {
  it('recognizes image MIME types', () => {
    expect(isImageType('image/png')).toBe(true)
    expect(isImageType('image/jpeg')).toBe(true)
  })

  it('rejects non-image and empty types', () => {
    expect(isImageType('application/pdf')).toBe(false)
    expect(isImageType('')).toBe(false)
  })
})

describe('formatBytes', () => {
  it('shows bytes, kilobytes and megabytes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('drops the decimal for large values', () => {
    expect(formatBytes(200 * 1024)).toBe('200 KB')
  })
})

describe('fitWithin', () => {
  it('leaves images that already fit unchanged', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })

  it('scales down keeping the aspect ratio', () => {
    expect(fitWithin(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 })
  })

  it('handles a zero-sized image without dividing by zero', () => {
    expect(fitWithin(0, 0, 1600)).toEqual({ width: 0, height: 0 })
  })
})

describe('dataUrlBytes', () => {
  it('approximates the decoded size of a base64 data URL', () => {
    // "AAAA" decodes to 3 bytes.
    expect(dataUrlBytes('data:image/png;base64,AAAA')).toBe(3)
  })

  it('accounts for base64 padding', () => {
    // "AA==" decodes to 1 byte, "AAA=" to 2 bytes.
    expect(dataUrlBytes('data:text/plain;base64,AA==')).toBe(1)
    expect(dataUrlBytes('data:text/plain;base64,AAA=')).toBe(2)
  })

  it('returns 0 for a string that is not a data URL', () => {
    expect(dataUrlBytes('not-a-data-url')).toBe(0)
  })
})
