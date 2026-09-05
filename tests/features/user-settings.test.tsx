/**
 * Settings' You section, and the one setting on it that changes what is taught.
 *
 * Four things have to keep holding. It has to be reachable *as a settings
 * section* — it was a screen of its own at `/user` that only one link pointed
 * at, which is how Settings came to be the place a learner's own name was not.
 * The gender choice must reach *content* rather than sitting in storage looking
 * like it does something. The section must say where the data lives and name the
 * store, because "on this device, no account" is the whole answer to the
 * question a profile page is asked. And unsaid must stay a real answer: a
 * learner who never opens this tab sees exactly what they saw before it existed.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ContentRepository,
  type ContentPack,
  type ItemId,
  type LearningItem,
  type PackId,
  type SpeakerGender,
} from '../../src/domain/content';
import { APP } from '../../src/app/identity';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';
import { DEFAULT_PREFERENCES } from '../../src/storage';
import { id } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

/**
 * A pack holding one gendered pair, built here rather than added to the shared
 * fixture: two dozen suites assert that fixture's exact contents, so a pair
 * added there would be paid for in unrelated test edits — and a screen that
 * needs particular content should say which content it needs.
 */
function packWithPair(): ContentRepository {
  const sentence = (local: string, text: string, speakerGender: SpeakerGender): LearningItem => ({
    id: id<ItemId>(`test-es:item:${local}`),
    pack: id<PackId>('test-es'),
    type: 'sentence',
    text,
    level: 'a1',
    speakerGender,
  });

  const pack: ContentPack = {
    manifest: {
      id: id<PackId>('test-es'),
      name: 'Gendered pair',
      targetLanguage: 'es',
      version: '1.0.0',
      levels: ['a1'],
      referenceLanguages: ['en'],
      files: [],
    },
    items: [
      sentence('900', 'Estoy cansado.', 'masculine'),
      sentence('901', 'Estoy cansada.', 'feminine'),
    ],
    lexemes: [],
    senses: [],
    forms: [],
    skills: [],
    translations: [],
    passages: [],
    audio: [],
  };

  return ContentRepository.from([pack]);
}

/** The section, at its address. */
const route = '/es/all/settings?tab=user';

describe('the You section of Settings', () => {
  it('is a settings section rather than a screen of its own', async () => {
    renderWithServices(<SettingsScreen />, { route });

    // Named in the switcher like every other section, and marked as the open
    // one: the link on Settings that used to leave for `/user` is what this
    // replaces.
    const switcher = await screen.findByRole('navigation', { name: 'Settings sections' });
    expect(within(switcher).getByRole('link', { name: 'You' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await screen.findByRole('heading', { name: 'You', level: 2 })).toBeInTheDocument();
  });

  it('says where the data lives before it says how much of it there is', async () => {
    renderWithServices(<SettingsScreen />, { route });

    const notice = await screen.findByText(/stored on this device only/);
    expect(notice).toHaveTextContent('There is no account');
    expect(notice).toHaveTextContent('nothing is uploaded');
    // The honest caveat: this is the one thing that deletes it, and a learner
    // who does not know that can lose everything by tidying their browser.
    expect(notice).toHaveTextContent(/Clearing this browser’s data/);
  });

  it('names where it is rather than gesturing at it, servers included', async () => {
    renderWithServices(<SettingsScreen />, { route });

    const where = await screen.findByRole('list', { name: 'Where your data is stored' });
    // The database, from the one place the app's identity is spelled — a
    // literal here would be the 37th copy of a name `identity.ts` owns.
    expect(
      within(where).getByText(new RegExp(`IndexedDB database “${APP.id}”`)),
    ).toBeInTheDocument();
    // "Where is it" has an answer about the network too, and "no server" is a
    // fact a learner is entitled to before they type their name into anything.
    const servers = within(where).getByText('Servers').closest('li');
    expect(servers).toHaveTextContent('There is no account');
    expect(servers).toHaveTextContent('nothing here leaves the device');
  });

  it('reports what is stored, counted rather than estimated', async () => {
    const services = testServices();
    await services.storage.attempts.append({
      id: 'a1',
      subject: id<ItemId>('test-es:item:000001'),
      exerciseKind: 'reveal',
      grade: 'good',
      at: 1,
      correct: true,
    });

    renderWithServices(<SettingsScreen />, { services, route });

    // Both halves awaited, because they arrive in two renders: the label is
    // there at once and the count follows when storage answers. A synchronous
    // `getByText` here passed on an idle machine and lost the race under a full
    // suite, which is the worst way for a test to be wrong.
    const answers = (await screen.findByText('Answers recorded')).closest('li');
    expect(await within(answers as HTMLElement).findByText('1')).toBeInTheDocument();
  });

  it('stores a name once, on the way out of the field rather than per keystroke', async () => {
    const user = userEvent.setup();
    const updatePreferences = vi.fn();
    renderWithServices(<SettingsScreen />, { route, updatePreferences });

    const field = await screen.findByLabelText('Name');
    await user.type(field, 'Elena');
    // Six characters, no writes: a controlled field here would have written to
    // IndexedDB once per letter.
    expect(updatePreferences).not.toHaveBeenCalled();

    await user.tab();
    expect(updatePreferences).toHaveBeenCalledExactlyOnceWith({ displayName: 'Elena' });
  });

  it('offers unsaid as a real answer, and starts there', async () => {
    renderWithServices(<SettingsScreen />, { route });

    expect(DEFAULT_PREFERENCES.speakerGender).toBe('');
    const unset = await screen.findByRole('radio', { name: 'Not specified' });
    expect(unset).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the sentence the choice changes, from the pack rather than from prose', async () => {
    const user = userEvent.setup();
    const updatePreferences = vi.fn();
    renderWithServices(<SettingsScreen />, {
      services: testServices({
        repository: packWithPair(),
        preferences: { ...DEFAULT_PREFERENCES, speakerGender: 'feminine' },
      }),
      route,
      updatePreferences,
    });

    // The shortest true explanation of what the setting does: the pair, with the
    // learner's half named — and the other half named as still taught, because
    // a control that reads as "hide the rest" would be describing a filter.
    const example = await screen.findByText(/comes first/);
    expect(example).toHaveTextContent('Estoy cansada.');
    expect(example).toHaveTextContent('is still taught');

    await user.click(screen.getByRole('radio', { name: 'Masculine' }));
    expect(updatePreferences).toHaveBeenCalledExactlyOnceWith({ speakerGender: 'masculine' });
  });
});
