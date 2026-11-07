import { useState } from 'react';
import { applyUpdate, useUpdateState } from '../app/updates';
import { Button } from './Button';
import { Icon } from './Icon';
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
 *
 * Except when this tab has lost its database connection. Then nothing practised
 * here can be saved, so the banner is an alert and offers no "Later".
 */
export function UpdateBanner({ onReload = applyUpdate }: UpdateBannerProps) {
  const state = useUpdateState();
  const [dismissed, setDismissed] = useState(false);

  if (state === 'none' || (state === 'ready' && dismissed)) return null;

  const required = state === 'required';
  return (
    <div className={styles.banner} role={required ? 'alert' : 'status'}>
      <p className={styles.message}>
        <Icon name="update" size="sm" className={styles.icon} />
        {required
          ? 'This tab can no longer save progress. Reload to keep practising.'
          : 'A new version is ready.'}
      </p>
      <div className={styles.actions}>
        {!required && (
          <Button variant="ghost" onClick={() => setDismissed(true)}>
            Later
          </Button>
        )}
        <Button variant="primary" onClick={onReload}>
          Reload
        </Button>
      </div>
    </div>
  );
}
