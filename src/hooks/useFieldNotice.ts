import { useCallback, useEffect, useRef } from 'react'

/**
 * Fires `notify` once after an edit to a save-button-less field settles —
 * when the field loses focus (`flush`), or when the component unmounts
 * (e.g. the modal closed) with a still-unflushed change. This avoids the
 * per-keystroke noise an onChange toast would produce.
 *
 * Usage: call `markChanged()` from the input's onChange and `flush` from
 * its onBlur.
 */
export function useFieldNotice(notify: () => void): {
  markChanged: () => void
  flush: () => void
} {
  const dirty = useRef(false)
  const notifyRef = useRef(notify)
  useEffect(() => {
    notifyRef.current = notify
  })

  const markChanged = useCallback(() => {
    dirty.current = true
  }, [])

  const flush = useCallback(() => {
    if (dirty.current) {
      dirty.current = false
      notifyRef.current()
    }
  }, [])

  // Notify on unmount (the modal/menu closed) if an edit was never flushed.
  useEffect(
    () => () => {
      if (dirty.current) notifyRef.current()
    },
    [],
  )

  return { markChanged, flush }
}
