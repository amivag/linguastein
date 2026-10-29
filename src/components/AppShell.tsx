import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { documentTitle } from '../app/identity';
import { PageLayout } from '../layout/PageLayout';
import { AppNav } from './AppNav';
import { Breadcrumb, type Crumb } from './Breadcrumb';
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
  /**
   * The places above this one, nearest last — `Study › Missions` over a mission.
   *
   * A screen passes it rather than the shell deriving it, because the chain is
   * not the URL's. `/es/a1/mission/cafe/understand` has no `/study` segment in
   * it, and a session over that mission has neither; where a screen *belongs* is
   * a fact about the app that only the screen and its URL codec hold, which is
   * why `studyTrail` lives beside `studyPath` rather than here.
   *
   * Omit it on a screen the tab bar already places. Home, Study, Progress and
   * Settings are the four destinations `AppNav` shows at all times, so a trail
   * on one of those would spend a line of a sticky header restating what is
   * already lit up on screen.
   */
  readonly trail?: readonly Crumb[];
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
 * Spanish app composition: course navigation, history, speech and updates.
 * The shared PageLayout owns page structure and responsive spacing.
 */
export function AppShell({
  title,
  subtitle,
  trail,
  children,
  onBack,
  action,
  showNav = true,
  wide = false,
}: AppShellProps) {
  const navigate = useNavigate();
  const back = onBack === 'history' ? () => void navigate(-1) : onBack;

  return (
    <PageLayout
      title={title}
      {...(subtitle ? { subtitle } : {})}
      documentTitle={documentTitle(subtitle ? `${title} · ${subtitle}` : title)}
      leading={
        back && (
          <button type="button" className={styles.back} onClick={back} aria-label="Go back">
            <Icon name="back" size="lg" />
          </button>
        )
      }
      trail={trail && <Breadcrumb items={trail} />}
      actions={
        <>
          {/* A screen without the tab bar still offers the course home. */}
          {!showNav && <HomeLink />}
          <VoicePresence />
          {action}
        </>
      }
      notice={<UpdateBanner />}
      navigation={showNav && <AppNav />}
      navigationLayout="bar-rail"
      wide={wide}
    >
      {children}
    </PageLayout>
  );
}
