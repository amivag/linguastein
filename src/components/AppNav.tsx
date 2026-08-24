import { Link, useLocation } from 'react-router';
import { useCourse } from '../app/course';
import { Icon, type IconName } from './Icon';
import styles from './AppNav.module.css';

interface NavItem {
  /** Screen segment under the course prefix; empty is the course home. */
  readonly screen: string;
  readonly label: string;
  readonly icon: IconName;
  /**
   * Further segments this destination owns, so the tab stays lit while a learner
   * is inside it. A sheet and a text are places you get to *from* Study, not
   * separate sections, and a nav that goes dark once you arrive is a nav that
   * has stopped telling you where you are.
   */
  readonly owns?: readonly string[];
}

/**
 * Home first, then the two things a learner does with material: read it, and find
 * out whether they know it.
 *
 * That split is the domain's rather than a nav invention — `mode: 'study'`
 * records nothing and `mode: 'practice'` feeds the scheduler — and it used to be
 * the whole of this list, with the course home labelled **Test**. Which was
 * accurate about what that screen did and wrong about where it sat: it is the
 * address a learner lands on, the one `/` redirects to and the one every deep
 * link resolves into, so calling it Test made the app open on an activity rather
 * than on a place. A learner returning after three days arrived already inside
 * one of four things they could be doing, with no screen that simply said what
 * this course is and where they had got to.
 *
 * So the course home is Home, and it now answers that question first and
 * recommends second — see `features/home/HomeScreen.tsx`. Practice did not move
 * anywhere: it is still reached from the recommendation at the top of Home and
 * from Free practice underneath it, which is where it was already reached from.
 *
 * Browse and Read remain sheets inside Study rather than destinations of their
 * own; the deep links still work and still resolve.
 */
const ITEMS: readonly NavItem[] = [
  { screen: '', label: 'Home', icon: 'home' },
  { screen: 'study', label: 'Study', icon: 'study', owns: ['browse', 'read'] },
  { screen: 'progress', label: 'Progress', icon: 'progress' },
  { screen: 'settings', label: 'Settings', icon: 'settings' },
];

/**
 * Primary navigation: a tab bar under the thumb on a phone, a rail on the left
 * once there is room for one. The active destination carries
 * `aria-current="page"`, so the current section is announced rather than only
 * coloured.
 *
 * It is fixed on every screen except a running session, and deliberately never
 * a hamburger: four destinations is not enough to hide, and a menu that has to
 * be opened is a menu that has to be *found* — the reason a learner on a phone
 * should never be one wrong tap from being lost is that the app is used in
 * two-minute stretches, standing up.
 *
 * The active tab wears a filled pill rather than only a colour change, because
 * a colour alone was not enough to locate at a glance on a bright screen — and
 * the label never disappears, so the icons do not have to be self-explanatory.
 */
export function AppNav() {
  const { path } = useCourse();
  const { pathname } = useLocation();

  /**
   * Whether a destination is the one the learner is in, counting the segments it
   * owns.
   *
   * Computed here rather than left to `NavLink`, which cannot express it:
   * `NavLink` resolves `aria-current` as `isActive ? prop : undefined`, so a
   * section is only ever marked for its *own* path and passing the attribute for
   * a sheet is silently dropped. That left a learner on `/browse` told they were
   * in no section at all — a plain `Link` and one predicate is less machinery
   * than working around it.
   */
  const isActive = (item: NavItem): boolean => {
    const covers = (screen: string) => {
      const target = path(screen);
      return pathname === target || pathname.startsWith(`${target}/`);
    };
    // The course home is a prefix of every other destination, so it matches
    // exactly or it would light up on all of them.
    if (item.screen === '') return pathname === path('');
    return covers(item.screen) || (item.owns ?? []).some(covers);
  };

  return (
    <nav className={styles.nav} aria-label="Main">
      <ul className={styles.list}>
        {ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.screen}>
              <Link
                to={path(item.screen)}
                className={`${styles.link} ${active ? styles.active : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className={styles.pill}>
                  <Icon name={item.icon} />
                </span>
                <span className={styles.label}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
