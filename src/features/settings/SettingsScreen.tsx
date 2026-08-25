import { useSearchParams } from 'react-router';
import { useCourse } from '../../app/course';
import { AppShell } from '../../components/AppShell';
import { SectionTabs } from '../../components/SectionTabs';
import { AboutSettings } from './AboutSettings';
import { AudioSettings } from './AudioSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { LearningSettings } from './LearningSettings';
import { PackSettings } from './PackSettings';
import { UserSettings } from './UserSettings';
import {
  parseSettingsTab,
  SETTINGS_TAB_OPTIONS,
  settingsPath,
  type SettingsTab,
} from './settings-url';
import styles from './Settings.module.css';

/**
 * Settings, in six sections rather than one column.
 *
 * The list it replaced was eleven cards deep, and the two things a learner
 * actually comes here to change — the course and the voice — were the first and
 * the fifth, with the app's own facts about itself interleaved. So the sections
 * are grouped by *whose* setting it is: You, Learning, Appearance and Audio are
 * the learner's, Packs and About are the app's.
 *
 * You is the section that was a separate screen at `/user`, reachable only from
 * a link above these tabs — so a learner looking under Settings for their name,
 * or for what this device is holding, found the one thing Settings did not
 * contain. `/user` still resolves, into that tab.
 *
 * The open section is in the query string rather than in state, so `?tab=packs`
 * is an address like every other view in this app — see `settings-url.ts`. One
 * `<h1>`, one `<main>`: the section is an `<h2>`, not a second page.
 */
export function SettingsScreen() {
  const { course } = useCourse();
  const [params] = useSearchParams();
  const tab = parseSettingsTab(params);
  const active = SETTINGS_TAB_OPTIONS.find((option) => option.id === tab);

  return (
    <AppShell title="Settings">
      <SectionTabs
        label="Settings sections"
        current={tab}
        tabs={SETTINGS_TAB_OPTIONS.map((option) => ({
          id: option.id,
          label: option.label,
          icon: option.icon,
          to: settingsPath(course, option.id),
        }))}
      />

      <section className={styles.group} aria-labelledby="settings-section">
        <h2 className={styles.groupTitle} id="settings-section">
          {active?.label ?? 'Settings'}
        </h2>
        {active && <p className={styles.sectionSummary}>{active.summary}</p>}
        <Section tab={tab} />
      </section>
    </AppShell>
  );
}

function Section({ tab }: { readonly tab: SettingsTab }) {
  switch (tab) {
    case 'user':
      // The learner rather than the app: what to call them, the gender they
      // speak about themselves in, and an account of what is on this device.
      return <UserSettings />;
    case 'learning':
      return <LearningSettings />;
    case 'appearance':
      return <AppearanceSettings />;
    case 'audio':
      // Playback and speech input together: the voice menu's controls, and the
      // check that says whether this device can hear at all.
      return <AudioSettings />;
    case 'packs':
      return <PackSettings />;
    case 'about':
      return <AboutSettings />;
  }
}
