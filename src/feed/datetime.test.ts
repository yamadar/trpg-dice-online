import { describe, it, expect } from 'vitest'
import { formatClock, formatFeedDate, sameDay } from './datetime'

describe('formatClock', () => {
  it('formats as H:mm without a leading zero on the hour', () => {
    expect(formatClock(new Date(2026, 4, 19, 8, 5))).toBe('8:05')
    expect(formatClock(new Date(2026, 4, 19, 13, 42))).toBe('13:42')
  })

  it('keeps midnight as 0:00', () => {
    expect(formatClock(new Date(2026, 4, 19, 0, 0))).toBe('0:00')
  })
})

describe('formatFeedDate', () => {
  it('writes the date in the Japanese style', () => {
    expect(formatFeedDate(new Date(2026, 4, 19), 'ja')).toBe('2026年5月19日')
  })

  it('writes the date in the English style', () => {
    expect(formatFeedDate(new Date(2026, 4, 19), 'en')).toBe('May 19, 2026')
  })
})

describe('sameDay', () => {
  it('is true for two instants on the same calendar day', () => {
    expect(sameDay(new Date(2026, 4, 19, 1, 0), new Date(2026, 4, 19, 23, 30))).toBe(true)
  })

  it('is false across a day boundary', () => {
    expect(sameDay(new Date(2026, 4, 19, 23, 59), new Date(2026, 4, 20, 0, 1))).toBe(false)
  })
})
