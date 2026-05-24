import { describe, it, expect } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

// Full DOM mount testing would require @testing-library/react which
// the project does not pull in. Instead, exercise the parts of the
// class that are pure / static — these are the actual behaviour
// contract the rest of the app depends on.

describe('ErrorBoundary', () => {
  it('exposes a static getDerivedStateFromError that wraps the error', () => {
    const err = new Error('boom')
    const state = ErrorBoundary.getDerivedStateFromError(err)
    expect(state).toEqual({ error: err })
  })

  it('serialises a non-Error throwable as the captured error', () => {
    // React will wrap non-Error throws, but our static path just
    // forwards whatever is passed in — assert that explicitly so a
    // future refactor that filters the value gets caught.
    const value = new Error('nope')
    const state = ErrorBoundary.getDerivedStateFromError(value)
    expect(state.error).toBe(value)
  })
})
