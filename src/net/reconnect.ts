/** How many times an unintentional disconnect is retried before giving up. */
export const MAX_RECONNECT_ATTEMPTS = 6

/**
 * Backoff in milliseconds before reconnect attempt `attempt` (1-based).
 * Grows linearly and is capped so a long outage does not stretch the gap
 * indefinitely. Pure, so it can be unit tested. */
export function reconnectDelay(attempt: number): number {
  const ms = 1000 + Math.max(0, attempt) * 1000
  return Math.min(ms, 8000)
}
