import { useSearchParams } from 'react-router-dom';
import { useCourse } from '../../app/course';
import { AppShell } from '../../components/AppShell';
import { SectionTabs } from '../../components/SectionTabs';
import { VoiceSettings } from '../../components/VoiceSettings';
import { AboutSettings } from './AboutSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { LearningSettings } from './LearningSettings';
import { PackSettings } from './PackSettings';
import {
  parseSettingsTab,
  SETTINGS_TAB_OPTIONS,
  settingsPath,
  type SettingsTab,
} from './settings-url';
import styles from './Settings.module.css';

/**
 * Settings, in five sections rather than one column.
 *
 * The list it replaced was eleven cards deep, and the two things a learner
 * actually comes here to change — the course and the voice — were the first and
 * the fifth, with the app's own facts about itself interleaved. So the sections
 * are grouped by *whose* setting it is: Learning, Appearance and Audio are the
 * learner's, Packs and About are the app's.
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
    case 'learning':
      return <LearningSettings />;
    case 'appearance':
      return <AppearanceSettings />;
    case 'audio':
      // The same control the header's voice menu opens, so a change made in
      // either place is the same change — there is nothing here the menu cannot
      // reach, and nothing in the menu that stops here.
      return <VoiceSettings />;
    case 'packs':
      return <PackSettings />;
    case 'about':
      return <AboutSettings />;
  }
}
