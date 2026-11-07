/**
 * Hearing a word from the list you found it in.
 *
 * Browse is where a learner comes to look something up, and until now it was the
 * one screen that could show them a Spanish word and not say it. The rules worth
 * holding: the button names its own row, it plays the *item* so a recording in
 * the pack is used before the device's voice, and it is absent rather than dead
 * when there is nothing to hear.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createAudioService, NOOP_PLAYBACK } from '../../src/audio';
import type { LearningItem } from '../../src/domain/content';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import { renderWithServices, testServices } from '../fixtures/services';

const results = () => within(screen.getByRole('list', { name: 'Results' }));

/**
 * The buttons appear once voice discovery resolves, which is a microtask — but a
 * microtask waiting its turn behind sixty jsdom environments in parallel, which
 * is the load `vite.config.ts` raises `testTimeout` for. `findBy`'s own budget is
 * a second and is not covered by that, so it is given one here.
 */
const DISCOVERED = { timeout: 5_000 };

describe('listening from Browse', () => {
  it('offers a play button per result, named after the phrase it would read', async () => {
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    // Named per row for the reason each line of a passage is: a screen of
    // identically-named play buttons is one an agent cannot pick from.
    expect(
      await screen.findByRole('button', { name: 'Listen to “agua”' }, DISCOVERED),
    ).toBeVisible();
    expect(
      results().getByRole('button', { name: 'Listen to “Tengo que trabajar.”' }),
    ).toBeVisible();
  });

  it('plays the item rather than reading its text, so a recording is preferred', async () => {
    const user = userEvent.setup();
    const base = testServices();
    const play = vi.fn(() => Promise.resolve(NOOP_PLAYBACK));
    const services = { ...base, audio: { ...base.audio, play } };

    renderWithServices(<BrowseScreen />, { services, route: '/browse' });
    await user.click(await screen.findByRole('button', { name: 'Listen to “agua”' }, DISCOVERED));

    // `play(item, …)` resolves canonical audio first and falls back to speech;
    // `speak(text)` would skip the pack's own recordings entirely.
    expect(play).toHaveBeenCalledTimes(1);
    const [item] = play.mock.calls[0] as unknown as [LearningItem];
    expect(item.text).toBe('agua');
  });

  it('says nothing rather than offering a control that cannot play', async () => {
    const base = testServices();
    const services = {
      ...base,
      // No TTS provider and no learner-chosen voice: what can be heard is then
      // exactly what the pack ships a recording of.
      audio: createAudioService({
        repository: base.repository,
        assetBaseUrl: 'https://example.test/packs/',
      }),
    };

    renderWithServices(<BrowseScreen />, { services, route: '/browse' });
    await screen.findByRole('button', { name: /^Listen to/ }, DISCOVERED);

    // The fixture records one item. Forty buttons that do nothing would be
    // worse than none, so the other six rows have no button at all.
    const buttons = results().getAllByRole('button', { name: /^Listen to/ });
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Listen to “Tengo que trabajar.”',
    ]);
  });
});
