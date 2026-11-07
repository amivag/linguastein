import { Link } from 'react-router';
import type { Course } from '../../domain/content';
import { ORDERINGS, type Ordering } from '../../domain/sessions';
import { sessionPath, type SessionUrl } from './session-url';
import styles from './Practice.module.css';

interface SessionOrderProps {
  readonly course: Course;
  /** The session as parsed, so a switch keeps every other facet of it. */
  readonly url: SessionUrl;
}

/**
 * What order to see a study set in.
 *
 * `?order=` has been carried by `session-url.ts` since sessions existed, and
 * three screens set it when they build a link — but a learner already inside a
 * set had no way to change it. That is the last of roadmap item 2: previous,
 * next and no scoring were in place, and the order toggle was not.
 *
 * **Study sessions only.** A tracked session's order is the scheduler's opinion
 * about what to lead with, and `smart` is that opinion; offering to override it
 * mid-practice would invite treating the queue as a playlist. Studying is
 * browsing — it records nothing and is not scored — so the order there is a
 * reading preference and belongs to the reader.
 *
 * **Links rather than buttons, because the URL is the state.** A session is fully
 * described by its query string, so an order switch is a different address for
 * the same material: reloadable, shareable, and scriptable. It does restart the
 * set, which is the honest consequence of asking for a different order rather
 * than a defect — and a study session has nothing to lose by restarting, since it
 * records nothing.
 */
export function SessionOrder({ course, url }: SessionOrderProps) {
  const current = url.ordering ?? 'smart';

  return (
    <nav className={styles.order} aria-label="Card order">
      <ul className={styles.orderRow}>
        {ORDERINGS.map((ordering) => (
          <li key={ordering}>
            {/* `aria-current` rather than `aria-pressed`: these are addresses, and
                one of them is the address you are at. A pressed link is a
                category error a screen reader reads out as one. */}
            <Link
              className={styles.orderOption}
              to={sessionPath(course, { ...url, ordering })}
              aria-current={ordering === current ? 'true' : undefined}
              title={ORDER_LABELS[ordering].title}
            >
              {ORDER_LABELS[ordering].label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * What each order actually does, in a learner's terms rather than the planner's.
 *
 * `smart` is the one worth naming carefully: it is not "clever", it is weak and
 * due material first with new items rationed in — so the label says that and the
 * title says the rest. Calling it Smart would be a promise the sort cannot keep.
 */
const ORDER_LABELS: Record<Ordering, { label: string; title: string }> = {
  smart: {
    label: 'Needs work',
    title: 'Weak and due cards first, with a few new ones mixed in',
  },
  sequential: {
    label: 'In order',
    title: 'The order the pack authored them in',
  },
  random: {
    label: 'Shuffled',
    title: 'A different order each time you start',
  },
};
