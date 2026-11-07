import { useLocation, useNavigate } from 'react-router';
import { useCourse } from '../../app/course';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { studyPath } from '../study/study-url';
import styles from './NotFound.module.css';

/**
 * The screen for an address the app does not have.
 *
 * Every unrecognised path used to redirect to the course home, silently. That is
 * the worst of the options available: a learner following a stale bookmark, a
 * shared link to a screen that has since moved, or a mistyped address all landed
 * on a working page that was not the one they asked for, with nothing to say so —
 * and the same treatment covered "this URL is nonsense" and "the content behind
 * this URL is no longer here", which are different problems with different fixes.
 *
 * So the redirect is now reserved for what it was actually for — a path with no
 * course on it, which is what `/` is — and anything genuinely unrecognised says
 * so and offers the way on.
 *
 * The address is quoted back deliberately. It is the one piece of information the
 * learner does not already have, and it is what makes the difference between "the
 * app is broken" and "that link is wrong" legible without opening the address bar.
 */
export function NotFoundScreen({
  /** What was missing, when the caller knows more than "this path". */
  reason,
}: {
  readonly reason?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { course, option, path } = useCourse();

  // The course named the way the rest of the app names it, rather than by
  // upper-casing a language tag: `Español · A1`, not `ES ALL`.
  const level = option?.levels.find((entry) => entry.level === course.level);
  const here = [option?.englishLabel, level?.label].filter(Boolean).join(' · ');

  return (
    <AppShell title="Not found" onBack="history">
      <section className={styles.empty}>
        <Icon name="unknown" size="xl" />
        <p role="status">{reason ?? 'There is no page at this address.'}</p>
        <p className={styles.address} lang="en">
          {location.pathname}
          {location.search}
        </p>
        <div className={styles.actions}>
          <Button variant="primary" block onClick={() => void navigate(path())}>
            {here ? `Go to ${here}` : 'Go to the course home'}
          </Button>
          <Button block onClick={() => void navigate(studyPath(course))}>
            Browse what this course has
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
