import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { documentTitle } from '../app/identity';
import { AppNav } from './AppNav';
import { HomeLink } from './HomeLink';
import { Icon } from './Icon';
import { UpdateBanner } from './UpdateBanner';
import { VoicePresence } from './VoicePresence';
import styles from './AppShell.module.css';

interface AppShellProps {
  readonly title: string;
  /**
   * A second line under the title, for a screen whose name and whose mode are
   * two different facts — a session is *what* you are practising, drawn large,
   * and *how*, drawn small. Kept out of the `<h1>` so the heading stays the
   * subject rather than becoming a sentence about it.
   */
  readonly subtitle?: string;
  readonly children: ReactNode;
  readonly onBack?: 'history' | (() => void);
  readonly action?: ReactNode;
  /** Practice sessions hide the chrome and fill the screen. */
  readonly showNav?: boolean;
  /**
   * Lets a screen use the full width of a desktop window rather than the reading
   * column.
   *
   * The narrow default is a rule about *prose*: a passage set across 1400px is
   * unreadable, and every screen that shows language keeps the cap. A dashboard
   * is not prose — Home is a survey of cards, and at 1440px the reading column
   * left a 269px dead gap with 44% of the width unused, which is most of why the
   * screen read as empty rather than as calm.
   *
   * Off by default, so a screen has to argue for it.
   */
  readonly wide?: boolean;
}

/**
 * Single-column mobile layout with a compact header.
 *
 * Every screen gets exactly one `<h1>`, one `<main>` and a matching document
 * title, so both screen readers and automated agents can tell where they are.
 *
 * The header sticks: it carries the way back and the voice control, and both
 * are needed halfway down a long passage as much as at the top of it.
 */
export function AppShell({
  title,
  subtitle,
  children,
  onBack,
  action,
  showNav = true,
  wide = false,
}: AppShellProps) {
  const navigate = useNavigate();
  const back = onBack === 'history' ? () => void navigate(-1) : onBack;

  useEffect(() => {
    // Both, where there are both: a tab reading "Quick practice" says nothing
    // about which of five open sessions it is.
    document.title = documentTitle(subtitle ? `${title} · ${subtitle}` : title);
  }, [title, subtitle]);

  return (
    <div className={`${styles.shell} ${showNav ? styles.withNav : ''} ${wide ? styles.wide : ''}`}>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        {back && (
          <button type="button" className={styles.back} onClick={back} aria-label="Go back">
            <Icon name="back" size="lg" />
          </button>
        )}
        <div className={styles.heading}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {/* A screen without the tab bar still has to offer the way out of it.
            Paired with the shell's own rule rather than passed in, so a screen
            cannot hide the nav and forget. */}
        {!showNav && <HomeLink />}
        {/* Every screen, pinned: the app's voice is a running condition, not a
            setup step, so what is speaking — or that nothing is — stays visible
            and adjustable wherever you are. */}
        <VoicePresence />
        {action}
      </header>
      <main id="main" className={styles.main} tabIndex={-1}>
        {/* Inside `main` so the skip link reaches it, and above the content so it
            is read before whatever the screen is asking of you. Renders nothing
            until the worker reports a new build. */}
        <UpdateBanner />
        {children}
      </main>
      {showNav && <AppNav />}
    </div>
  );
}
