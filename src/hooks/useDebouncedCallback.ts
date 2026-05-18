import { useCallback, useEffect, useRef } from 'react'

/**
 * A debounced wrapper around `fn`: each call resets a timer, and `fn`
 * runs only once the calls stop for `delayMs`. Useful for firing one
 * notification after a burst of edits settles, rather than per keystroke.
 */
export function useDebouncedCallback(fn: () => void, delayMs: number): () => void {
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timerRef.current), [])

  return useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fnRef.current(), delayMs)
  }, [delayMs])
}
