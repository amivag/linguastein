import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  /** Injectable so a test can assert what was reported without a real console. */
  readonly onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

/**
 * The last thing between a thrown render and a white screen.
 *
 * `App` already handles *boot* failure — a dataset that will not load shows a
 * message. Nothing caught a throw from inside a screen, so any such bug rendered
 * as a blank page: no message, no way back, and on a phone no console to look at.
 * For an app used in two-minute stretches that is indistinguishable from the app
 * being broken.
 *
 * Deliberately a class. React has no hook for this — `componentDidCatch` and
 * `getDerivedStateFromError` are the only way to catch a descendant's throw — and
 * that is worth stating, because it looks like an oversight next to everything
 * else here being a function.
 *
 * Three things it does *not* do, each on purpose:
 *
 * - **It does not phone home.** There is no telemetry seam in this app and
 *   inventing one here would put a network call in the one code path that runs
 *   when things are already wrong. `onError` is the seam; wire it to a reporter
 *   in `services.ts` if a project ever wants one.
 * - **It does not clear stored state.** A render bug is not a reason to delete a
 *   learner's history, and "reset everything" as the only offered escape is how
 *   people lose data to a bug that a reload would have survived.
 * - **It does not retry by itself.** A boundary that re-renders the same broken
 *   tree loops. Reloading is the learner's call.
 *
 * The message shows the error text because this is a local-first app with public
 * source and a sourcemapped build: there is nothing to leak, and a bug report
 * that quotes the message is worth more than a prettier dead end.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const report = this.props.onError;
    if (report) {
      report(error, info);
      return;
    }
    // Kept rather than swallowed: without it a caught error leaves no trace at
    // all, which is worse for diagnosis than the blank page this replaced.
    console.error('Unhandled error in the interface', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className={styles.screen}>
        <h1 className={styles.title}>Something went wrong</h1>
        <p>
          The screen you were on could not be drawn. Your progress is stored on this device and has
          not been touched.
        </p>
        {/*
          A reload rather than a link to `/`: an in-app navigation would leave the
          broken component tree mounted and the boundary would catch the same
          throw again. And a bare `<button>` rather than the shared one, because
          `Button` lives in the layer that just failed — a fallback importing from
          the broken side of the app can fail the same way.
        */}
        <button type="button" className={styles.action} onClick={() => window.location.reload()}>
          Reload the app
        </button>
        <p className={styles.detail}>{error.message}</p>
      </div>
    );
  }
}
