import { useState } from 'react';
import { applyUpdate, useUpdateReady } from '../app/updates';
import { Button } from './Button';
import styles from './UpdateBanner.module.css';

interface UpdateBannerProps {
  /** Injectable so a test can assert the reload without navigating jsdom. */
  readonly onReload?: () => void;
}

/**
 * Offers the update that the service worker has already downloaded.
 *
 * In normal flow rather than fixed to the viewport, and never focused: it can
 * appear during a practice session, and a bar that overlays the answer buttons or
 * steals focus mid-question is worse than a stale build. `role="status"` means it
 * is announced without interrupting, and it can be dismissed — the update is
 * still applied on the next natural load either way.
 */
export function UpdateBanner({ onReload = applyUpdate }: UpdateBannerProps) {
  const ready = useUpdateReady();
  const [dismissed, setDismissed] = useState(false);

  if (!ready || dismissed) return null;

  return (
    <div className={styles.banner} role="status">
      <p className={styles.message}>A new version is ready.</p>
      <div className={styles.actions}>
        <Button variant="ghost" onClick={() => setDismissed(true)}>
          Later
        </Button>
        <Button variant="primary" onClick={onReload}>
          Reload
        </Button>
      </div>
    </div>
  );
}
