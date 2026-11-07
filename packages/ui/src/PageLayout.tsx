import { useEffect, type ReactNode } from 'react';
import styles from './PageLayout.module.css';

export interface PageLayoutProps {
  readonly title: string;
  readonly subtitle?: string;
  /** The host owns branding and title formatting. */
  readonly documentTitle: string;
  readonly children: ReactNode;
  readonly leading?: ReactNode;
  readonly trail?: ReactNode;
  readonly actions?: ReactNode;
  /** Notices come first inside main, where the skip link reaches them. */
  readonly notice?: ReactNode;
  readonly navigation?: ReactNode;
  /** Reserve token-sized space for a fixed mobile bar / desktop rail. */
  readonly navigationLayout?: 'flow' | 'bar-rail';
  readonly wide?: boolean;
  readonly skipLabel?: string;
}

/** Accessible page structure with no router, services or subject dependencies. */
export function PageLayout({
  title,
  subtitle,
  documentTitle,
  children,
  leading,
  trail,
  actions,
  notice,
  navigation,
  navigationLayout = 'flow',
  wide = false,
  skipLabel = 'Skip to content',
}: PageLayoutProps) {
  const fixedNav = navigation != null && navigation !== false && navigationLayout === 'bar-rail';
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <div className={`${styles.shell} ${fixedNav ? styles.withNav : ''} ${wide ? styles.wide : ''}`}>
      <a className={styles.skipLink} href="#main">
        {skipLabel}
      </a>
      <header className={styles.header}>
        {leading}
        <div className={styles.heading}>
          {trail}
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions}
      </header>
      <main id="main" className={styles.main} tabIndex={-1}>
        {notice}
        {children}
      </main>
      {navigation}
    </div>
  );
}
