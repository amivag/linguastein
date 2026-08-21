import { NavLink } from 'react-router-dom';
import { useCourse } from '../app/course';
import { Icon, type IconName } from './Icon';
import styles from './AppNav.module.css';

interface NavItem {
  /** Screen segment under the course prefix; empty is the course home. */
  readonly screen: string;
  readonly label: string;
  readonly icon: IconName;
}

const ITEMS: readonly NavItem[] = [
  { screen: '', label: 'Practice', icon: 'practice' },
  { screen: 'read', label: 'Read', icon: 'read' },
  { screen: 'browse', label: 'Browse', icon: 'browse' },
  { screen: 'progress', label: 'Progress', icon: 'progress' },
  { screen: 'settings', label: 'Settings', icon: 'settings' },
];

/**
 * Primary navigation: a tab bar under the thumb on a phone, a rail on the left
 * once there is room for one. `NavLink` marks the active destination with
 * `aria-current="page"`, so the current section is announced rather than only
 * coloured.
 *
 * It is fixed on every screen except a running session, and deliberately never
 * a hamburger: five destinations is not enough to hide, and a menu that has to
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

  return (
    <nav className={styles.nav} aria-label="Main">
      <ul className={styles.list}>
        {ITEMS.map((item) => (
          <li key={item.screen}>
            <NavLink
              to={path(item.screen)}
              // The course home is a prefix of every other destination, so it
              // has to match exactly or it would light up on all of them.
              end={item.screen === ''}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              <span className={styles.pill}>
                <Icon name={item.icon} />
              </span>
              <span className={styles.label}>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
