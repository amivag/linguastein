import { NavLink } from 'react-router-dom';
import styles from './AppNav.module.css';

interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: string;
}

const ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Practice', icon: '◎' },
  { to: '/browse', label: 'Browse', icon: '⌕' },
  { to: '/progress', label: 'Progress', icon: '▦' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

/**
 * Primary navigation: a tab bar under the thumb on a phone, a rail on the left
 * once there is room for one. `NavLink` marks the active destination with
 * `aria-current="page"`, so the current section is announced rather than only
 * coloured.
 */
export function AppNav() {
  return (
    <nav className={styles.nav} aria-label="Main">
      <ul className={styles.list}>
        {ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
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
