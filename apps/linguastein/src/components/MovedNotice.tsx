import { APP } from '../app/identity';
import { MOVED_TO } from '../app/version';
import { Icon } from './Icon';
import styles from './UpdateBanner.module.css';

interface MovedNoticeProps {
  /** Injectable for tests; the build sets it through `APP_MOVED_TO`. */
  readonly to?: string;
}

/**
 * Shown only by the build left at an old address after the app moves.
 *
 * Browser storage belongs to an address, so a learner's history cannot follow the
 * app by itself. This build keeps working, so the learner can still open it and
 * save a backup, which is what the notice asks them to do. It is a `status`, not
 * an alert: practising here still works, and nothing is lost by finishing first.
 */
export function MovedNotice({ to = MOVED_TO }: MovedNoticeProps) {
  if (!to) return null;

  return (
    <div className={styles.banner} role="status">
      <p className={styles.message}>
        <Icon name="update" size="sm" className={styles.icon} />
        <span>
          {APP.name} has moved to <a href={to}>{new URL(to).host}</a>. To keep your progress, save a
          backup in Settings → You, then restore it there.
        </span>
      </p>
    </div>
  );
}
