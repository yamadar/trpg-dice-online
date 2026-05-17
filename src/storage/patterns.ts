/** Generate a unique id for a saved roll pattern. */
export function newPatternId(): string {
  return `pat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
