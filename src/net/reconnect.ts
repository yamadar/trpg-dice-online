/**
 * How many times an unintentional disconnect is retried before giving up.
 * High enough to ride out a fairly long GM outage (with the 5s-capped
 * backoff, roughly a minute and a half of retrying).
 */
export const MAX_RECONNECT_ATTEMPTS = 15

/**
 * Backoff in milliseconds before reconnect attempt `attempt` (1-based).
 * Grows linearly and is capped at 5s so a participant keeps probing for
 * the GM at least every few seconds. Pure, so it can be unit tested. */
export function reconnectDelay(attempt: number): number {
  const ms = 1000 + Math.max(0, attempt) * 1000
  return Math.min(ms, 5000)
}
