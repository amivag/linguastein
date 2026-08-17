import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AppShell.module.css';

interface AppShellProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly onBack?: 'history' | (() => void);
  readonly action?: ReactNode;
}

/** Single-column mobile layout with a compact header. */
export function AppShell({ title, children, onBack, action }: AppShellProps) {
  const navigate = useNavigate();
  const back = onBack === 'history' ? () => void navigate(-1) : onBack;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        {back && (
          <button type="button" className={styles.back} onClick={back} aria-label="Go back">
            ←
          </button>
        )}
        <h1 className={styles.title}>{title}</h1>
        {action}
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
