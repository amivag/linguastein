/**
 * Settings' sections, and their addresses.
 *
 * Settings used to be one column of eleven cards, which is the shape that makes
 * a learner scroll past the thing they came for. It is five sections now, and
 * the open one lives in the query string rather than in component state — the
 * same rule Browse and a session follow, for the same three reasons: a reload
 * keeps you where you were, "the audio settings" is a link somebody can send,
 * and an agent can be told to go there.
 *
 * Both directions live here so a section cannot be written that the screen does
 * not read, which is the bug `session-url.ts` was split out to prevent.
 */

import { coursePath, type Course } from '../../domain/content';
import type { IconName } from '../../components/Icon';

export const SETTINGS_TABS = ['learning', 'appearance', 'audio', 'packs', 'about'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

/** The section a bare `/settings` opens: what a learner changes most. */
export const DEFAULT_SETTINGS_TAB: SettingsTab = 'learning';

export interface SettingsTabOption {
  readonly id: SettingsTab;
  /** The tab's label, and the heading of the section it opens. */
  readonly label: string;
  readonly icon: IconName;
  /** One line on what the section is for, shown under its heading. */
  readonly summary: string;
}

/**
 * The learner's own settings come first and are grouped together, which is the
 * distinction the single list lost: what you are learning and how you want to be
 * taught are yours, while the packs and the build are the app's.
 */
export const SETTINGS_TAB_OPTIONS: readonly SettingsTabOption[] = [
  {
    id: 'learning',
    label: 'Learning',
    icon: 'study',
    summary: 'What you are learning, and how a session behaves.',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: 'theme',
    summary: 'Light or dark, which colours, how much contrast, how big the text.',
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: 'speak',
    summary: 'Which voice speaks, and whether this device can hear you.',
  },
  {
    id: 'packs',
    label: 'Packs',
    icon: 'pack',
    summary: 'Content add-ons: what each one holds, and where it came from.',
  },
  {
    id: 'about',
    label: 'About',
    icon: 'explain',
    summary: 'This build, the design system, and the data stored on this device.',
  },
];

export function isSettingsTab(value: string | null | undefined): value is SettingsTab {
  return (
    value !== null && value !== undefined && (SETTINGS_TABS as readonly string[]).includes(value)
  );
}

/**
 * The section a URL asks for.
 *
 * An unrecognised name opens the default rather than erroring, the way a stale
 * course or an unknown sort does: a link that has outlived a section should show
 * Settings, not a blank screen.
 */
export function parseSettingsTab(params: URLSearchParams): SettingsTab {
  const tab = params.get('tab');
  return isSettingsTab(tab) ? tab : DEFAULT_SETTINGS_TAB;
}

/**
 * `/es/a1/settings?tab=packs`.
 *
 * The default section is left unsaid, as Browse leaves out pack order: a link a
 * human might read should not spell out the thing nobody chose.
 */
export function settingsPath(course: Course, tab: SettingsTab = DEFAULT_SETTINGS_TAB): string {
  const base = coursePath(course, 'settings');
  return tab === DEFAULT_SETTINGS_TAB ? base : `${base}?tab=${tab}`;
}
