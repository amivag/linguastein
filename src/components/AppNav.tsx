import { NavLink } from 'react-router-dom';
import { useCourse } from '../app/course';
import styles from './AppNav.module.css';

interface NavItem {
  /** Screen segment under the course prefix; empty is the course home. */
  readonly screen: string;
  readonly label: string;
  readonly icon: string;
}

const ITEMS: readonly NavItem[] = [
  { screen: '', label: 'Practice', icon: '◎' },
  { screen: 'read', label: 'Read', icon: '☰' },
  { screen: 'browse', label: 'Browse', icon: '⌕' },
  { screen: 'progress', label: 'Progress', icon: '▦' },
  { screen: 'settings', label: 'Settings', icon: '⚙' },
];

/**
 * Primary navigation: a tab bar under the thumb on a phone, a rail on the left
 * once there is room for one. `NavLink` marks the active destination with
 * `aria-current="page"`, so the current section is announced rather than only
 * coloured.
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
              <span className={styles.icon} aria-hidden="true">
                {item.icon}
              </span>
              <span className={styles.label}>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
