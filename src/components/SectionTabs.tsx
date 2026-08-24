import { Link } from 'react-router';
import { Icon, type IconName } from './Icon';
import styles from './SectionTabs.module.css';

export interface SectionTab {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconName;
  /** Where the tab goes. The section is an address, so this is a real link. */
  readonly to: string;
}

interface SectionTabsProps {
  /** Names the switcher for a screen reader, e.g. `Settings sections`. */
  readonly label: string;
  readonly tabs: readonly SectionTab[];
  readonly current: string;
}

/**
 * One screen's sections, as a strip of links.
 *
 * Links rather than an ARIA tab widget, deliberately. A section here *is* an
 * address — `?tab=grammar` — so the control that changes it is a navigation, and
 * `aria-current="page"` is the same idiom `AppNav` already uses to say where you
 * are. A `role="tablist"` would look identical and promise arrow-key semantics
 * that a set of links does not have; half a widget is worse than none.
 *
 * Shared by Settings and Study, which is the whole reason it is a component: the
 * second screen to want a section switcher is the moment the pattern either gets
 * extracted or gets copied, and a copied switcher is one that drifts on
 * accessibility rather than on colour.
 */
export function SectionTabs({ label, tabs, current }: SectionTabsProps) {
  return (
    <nav className={styles.tabs} aria-label={label}>
      <ul className={styles.tabList}>
        {tabs.map((tab) => {
          const active = tab.id === current;
          return (
            <li key={tab.id}>
              <Link
                to={tab.to}
                className={`${styles.tab} ${active ? styles.tabActive : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {tab.icon && <Icon name={tab.icon} size="sm" />}
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
