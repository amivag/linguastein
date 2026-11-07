/**
 * Settings in sections, and the packs section in particular.
 *
 * Two things are being protected. The open section is an *address*, so a link to
 * the audio settings has to keep working and an unrecognised one has to degrade
 * rather than break — the same contract Browse's filters and a session's URL
 * have. And a pack is an add-on, so what it holds has to be counted from the
 * repository rather than described: the number that made this worth writing was
 * Study's, which once advertised 546 verbs behind a sheet that listed none.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';
import {
  parseSettingsTab,
  settingsPath,
  SETTINGS_TAB_OPTIONS,
} from '../../src/features/settings/settings-url';
import { renderWithServices, testServices } from '../fixtures/services';

const settings = (route: string) => renderWithServices(<SettingsScreen />, { route });

const section = async (name: RegExp | string) => {
  const heading = await screen.findByRole('heading', { name, level: 2 });
  const owner = heading.closest('section');
  if (!owner) throw new Error(`no section for ${String(name)}`);
  return within(owner);
};

describe('the settings URL', () => {
  it('names every section, and leaves the default one unsaid', () => {
    const course = { language: 'es', level: 'a1' } as const;

    expect(settingsPath(course)).toBe('/es/a1/settings');
    expect(settingsPath(course, 'learning')).toBe('/es/a1/settings');
    expect(settingsPath(course, 'packs')).toBe('/es/a1/settings?tab=packs');
  });

  it('widens an unrecognised section to the default rather than erroring', () => {
    // A link that has outlived a section should still open Settings.
    expect(parseSettingsTab(new URLSearchParams('tab=voices'))).toBe('learning');
    expect(parseSettingsTab(new URLSearchParams())).toBe('learning');
    expect(parseSettingsTab(new URLSearchParams('tab=about'))).toBe('about');
  });
});

describe('the settings sections', () => {
  it('opens the section the URL asks for', async () => {
    settings('/es/all/settings?tab=appearance');

    const appearance = await section('Appearance');
    expect(appearance.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    expect(appearance.getByRole('radiogroup', { name: 'Colour palette' })).toBeInTheDocument();
    expect(appearance.getByRole('radiogroup', { name: 'Contrast' })).toBeInTheDocument();
    expect(appearance.getByRole('radiogroup', { name: 'Text size' })).toBeInTheDocument();
  });

  it('opens the learner’s own settings by default', async () => {
    settings('/es/all/settings');

    const learning = await section('Learning');
    expect(learning.getByLabelText(/Reference language/)).toBeInTheDocument();
    expect(learning.getByRole('checkbox', { name: 'Show elapsed time' })).toBeInTheDocument();
  });

  it('marks the open section and offers every other one as a link', async () => {
    settings('/es/all/settings?tab=packs');

    const switcher = await screen.findByRole('navigation', { name: 'Settings sections' });
    for (const option of SETTINGS_TAB_OPTIONS) {
      expect(within(switcher).getByRole('link', { name: option.label })).toBeInTheDocument();
    }
    // Announced rather than only coloured, the same way the main nav marks the
    // section a learner is in.
    expect(within(switcher).getByRole('link', { name: 'Packs' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(switcher).getByRole('link', { name: 'Audio' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('changes section by navigation, so the choice survives a reload', async () => {
    const user = userEvent.setup();
    settings('/es/all/settings');

    await user.click(screen.getByRole('link', { name: 'About' }));

    expect(await screen.findByRole('button', { name: 'Reset progress' })).toBeInTheDocument();
  });
});

describe('the packs section', () => {
  it('describes each pack as the add-on it is', async () => {
    settings('/es/all/settings?tab=packs');

    const packs = await section('Packs');
    const pack = packs.getByRole('article', { name: /Test Spanish/ });

    // The version is what a report about a sentence has to quote, and it moves
    // independently of the app's own version.
    expect(within(pack).getByText('1.0.0')).toBeInTheDocument();
    expect(within(pack).getByText('Spanish')).toBeInTheDocument();
    expect(within(pack).getByText('word cards')).toBeInTheDocument();
    expect(within(pack).getByText('texts')).toBeInTheDocument();
  });

  it('says when a pack has not been editorially reviewed', async () => {
    /*
     * Generated material must stay distinguishable from checked material — the
     * provenance rule the dataset build enforces. A settings screen that lists a
     * pack without its review state presents it as curriculum.
     */
    const services = testServices();
    renderWithServices(<SettingsScreen />, {
      services,
      route: '/es/all/settings?tab=packs',
    });

    const packs = await section('Packs');
    expect(packs.getByText(/not yet reviewed|not declared/i)).toBeInTheDocument();
  });

  it('attributes a skipped record to the pack that dropped it', async () => {
    const services = testServices({
      datasetIssues: [
        { severity: 'error', source: 'items.jsonl', message: 'bad record' },
        // Another pack's file, and a warning: neither is this pack's error.
        { severity: 'error', source: 'somewhere-else.jsonl', message: 'not ours' },
        { severity: 'warning', source: 'items.jsonl', message: 'only a warning' },
      ],
    });
    renderWithServices(<SettingsScreen />, {
      services,
      route: '/es/all/settings?tab=packs',
    });

    const packs = await section('Packs');
    expect(packs.getByText(/1 record was skipped/)).toBeInTheDocument();
  });
});
