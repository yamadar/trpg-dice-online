import { Component, type ErrorInfo, type ReactNode } from 'react'

interface FallbackArgs {
  error: Error
  reset: () => void
}

interface Props {
  children: ReactNode
  /**
   * What to render in place of `children` after a render-phase error is
   * caught. Receives the error and a `reset` callback that clears the
   * boundary's error state so the children remount and can try again.
   */
  fallback: (args: FallbackArgs) => ReactNode
  /**
   * Side-effect hook fired the first time an error is caught for the
   * current state. Use it to log / report — render-phase work belongs
   * inside `fallback`.
   */
  onCaught?: (error: Error, info: ErrorInfo) => void
  /**
   * When this value changes after an error was caught, the boundary
   * auto-clears its error state. Useful for "navigated away from the
   * broken view, so forget that error" semantics — e.g. closing the
   * tabletop panel resets the boundary so the next open is clean.
   */
  resetKey?: unknown
}

interface State {
  error: Error | null
}

/**
 * Generic React error boundary. Catches render-phase exceptions from
 * its child tree, surfaces them via the `fallback` render prop, and
 * exposes a `reset` callback so the consumer can offer an
 * "try again" affordance instead of leaving the user with a blank
 * screen.
 *
 * Class-based because `getDerivedStateFromError` / `componentDidCatch`
 * are the only React APIs that intercept render-phase errors — there
 * is no hook equivalent yet.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console logging is intentional: there's no remote sink in this
    // backend-less app, but a captured stack in DevTools is invaluable
    // when a player reports "the screen went blank."
    console.error('[ErrorBoundary] caught render error', error, info)
    this.props.onCaught?.(error, info)
  }

  componentDidUpdate(prevProps: Props): void {
    if (
      this.state.error &&
      prevProps.resetKey !== this.props.resetKey &&
      this.props.resetKey !== undefined
    ) {
      this.reset()
    }
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback({ error: this.state.error, reset: this.reset })
    }
    return this.props.children
  }
}
