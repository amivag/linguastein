import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppNav } from './AppNav';
import { UpdateBanner } from './UpdateBanner';
import styles from './AppShell.module.css';

interface AppShellProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly onBack?: 'history' | (() => void);
  readonly action?: ReactNode;
  /** Practice sessions hide the chrome and fill the screen. */
  readonly showNav?: boolean;
}

/**
 * Single-column mobile layout with a compact header.
 *
 * Every screen gets exactly one `<h1>`, one `<main>` and a matching document
 * title, so both screen readers and automated agents can tell where they are.
 */
export function AppShell({ title, children, onBack, action, showNav = true }: AppShellProps) {
  const navigate = useNavigate();
  const back = onBack === 'history' ? () => void navigate(-1) : onBack;

  useEffect(() => {
    document.title = `${title} · Lingo`;
  }, [title]);

  return (
    <div className={`${styles.shell} ${showNav ? styles.withNav : ''}`}>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        {back && (
          <button type="button" className={styles.back} onClick={back} aria-label="Go back">
            <span aria-hidden="true">←</span>
          </button>
        )}
        <h1 className={styles.title}>{title}</h1>
        {action}
      </header>
      <main id="main" className={styles.main} tabIndex={-1}>
        {/* Inside `main` so the skip link reaches it, and above the content so it
            is read before whatever the screen is asking of you. Renders nothing
            until the worker reports a new build. */}
        <UpdateBanner />
        {children}
      </main>
      {showNav && <AppNav />}
    </div>
  );
}
