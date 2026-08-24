/**
 * Which accent the app actually speaks in.
 *
 * `pronunciationLocale` is one preference across every course, so the stored
 * value and the effective value are not the same thing: `es-ES` is a real
 * choice on a Spanish course and nonsense on a French one. `CourseBar` corrects
 * the stored value when a learner switches language, and that is worth doing —
 * but the switcher is not the only way into a course.
 *
 * A shared link, a bookmark, or a reload lands on `/fr/b1/browse` having passed
 * through nothing, and every play button then asked the device for a Spanish
 * voice to read French with: silence at best, a Spanish reading of French at
 * worst. So the accent is resolved at every *read*, through
 * `usePronunciationLocale`, and these cases are the ones that regressed.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { NOOP_PLAYBACK } from '../../src/audio';
import type { PlayOptions } from '../../src/audio';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import { DEFAULT_PREFERENCES } from '../../src/storage';
import { multilingualRepository } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

/** Voice discovery is a microtask behind sixty parallel jsdom environments. */
const DISCOVERED = { timeout: 5_000 };

/**
 * Plays the named row from Browse, mounted under the real course route, and
 * hands back the locale the audio service was asked for.
 *
 * The fixtures make the two cases: the Spanish pack declares voices in `es-ES`
 * and `es-MX`, so both are real accents there, while the French pack declares
 * neither — which is the ordinary case for a new language, and the one that
 * has to resolve to a bare `fr` rather than to nothing.
 */
async function localeSpokenAt(route: string, stored: string, phrase: string) {
  const user = userEvent.setup();
  const base = testServices({
    repository: multilingualRepository(),
    preferences: { ...DEFAULT_PREFERENCES, pronunciationLocale: stored },
  });
  const play = vi.fn(() => Promise.resolve(NOOP_PLAYBACK));

  renderWithServices(
    <Routes>
      <Route path="/:language/:level/browse" element={<BrowseScreen />} />
    </Routes>,
    { services: { ...base, audio: { ...base.audio, play } }, route },
  );

  await user.click(
    await screen.findByRole('button', { name: `Listen to “${phrase}”` }, DISCOVERED),
  );

  const [, options] = play.mock.calls[0] as unknown as [unknown, PlayOptions];
  return options.locale;
}

describe('the accent a course is spoken in', () => {
  it('speaks the course’s language on a deep link, not the stored accent', async () => {
    // The bug: `es-ES` stored, French course opened straight from a link.
    expect(await localeSpokenAt('/fr/b1/browse', 'es-ES', 'Je dois travailler.')).toBe('fr');
  });

  it('does not fall back to the previous language’s other accent either', async () => {
    // `es-MX` is offered — by the Spanish pack. Offered somewhere is not
    // offered here, which is the check a plain "is it in the list" would pass.
    expect(await localeSpokenAt('/fr/b1/browse', 'es-MX', 'bonjour')).toBe('fr');
  });

  it('keeps a chosen accent the course actually offers', async () => {
    // The other half, and the reason this is a resolution rather than a reset:
    // a learner who picked Mexican Spanish keeps it.
    expect(await localeSpokenAt('/es/a1/browse', 'es-MX', 'agua')).toBe('es-MX');
  });

  it('corrects an accent this language does not have to its first', async () => {
    expect(await localeSpokenAt('/es/a1/browse', 'fr', 'agua')).toBe('es-ES');
  });
});
