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
import { DEFAULT_COURSE_STATE } from '../../src/storage';
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
    /*
     * Seeded on *both* languages, which is what makes this test still test
     * something. An accent is stored per course now, so the honest way to ask
     * "does a French screen speak French?" is to give French the same stored
     * `es-ES` the global value used to force on it, and check the course
     * narrows it anyway.
     */
    courses: {
      es: { ...DEFAULT_COURSE_STATE, pronunciationLocale: stored },
      fr: { ...DEFAULT_COURSE_STATE, pronunciationLocale: stored },
    },
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

/**
 * The same trip, with each course holding its *own* accent and voice.
 *
 * The helper above seeds both languages with one value, because it is about the
 * narrowing that has to happen when a stored accent cannot be right. This one is
 * about the thing that made that narrowing necessary: there was one value, and
 * two courses cannot share it (`docs/tasks/learner-profile.md` §4.1).
 */
async function spokenAt(route: string, phrase: string) {
  const user = userEvent.setup();
  const base = testServices({
    repository: multilingualRepository(),
    courses: {
      es: { ...DEFAULT_COURSE_STATE, pronunciationLocale: 'es-MX', voiceName: 'Paulina' },
      fr: { ...DEFAULT_COURSE_STATE, pronunciationLocale: 'fr', voiceName: 'Amelie' },
    },
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
  return options;
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

/**
 * Two courses, two sets of choices, neither reaching the other.
 *
 * This is the failure §4.1 describes rather than the patch over it. While the
 * accent and the voice were single global values, a learner studying both
 * languages had one of them wrong at all times — and the voice was the worse
 * half, because a `voiceName` is a *device* voice: `Paulina` cannot read French
 * at all, and nothing on screen would have said why the sound stopped.
 */
describe('two courses on one device', () => {
  it('speaks each one with its own accent and its own voice', async () => {
    expect(await spokenAt('/es/a1/browse', 'agua')).toMatchObject({
      locale: 'es-MX',
      voice: 'Paulina',
    });
    expect(await spokenAt('/fr/b1/browse', 'Je dois travailler.')).toMatchObject({
      locale: 'fr',
      voice: 'Amelie',
    });
  });
});
