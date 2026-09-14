/**
 * The typed-answer card, from keystroke to recorded attempt.
 *
 * Stage A of `docs/tasks/typed-production.md` on screen: the learner supplies
 * the words rather than picking or arranging them, and the card checks what they
 * supplied. The case worth a test of its own is the near miss — an answer that
 * counts and still says what was missing.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  ContentRepository,
  type ContentPack,
  type ItemId,
  type PackId,
} from '../../src/domain/content';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { createMemoryStorage, type LearnerStorage } from '../../src/storage';
import { id } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

const PACK = id<PackId>('typed-es');
const ITEM = id<ItemId>('typed-es:item:001');
const ANSWER = 'Ayer hablé con mi hermana.';

/**
 * One sentence, carrying an accent, in a pack of its own.
 *
 * Built rather than taken from the shared fixture for two reasons, and both are
 * about the test asserting what it claims to. A one-item pack makes the card
 * under test the only card the session can deal, so no seed or ordering decides
 * what is on screen. And the near-miss verdict only exists for an answer with a
 * written accent in it — every sentence in the shared fixture is unaccented, so
 * a test built on one would have skipped the case it was written for.
 */
function onePack(): ContentRepository {
  const pack: ContentPack = {
    manifest: {
      id: PACK,
      name: 'Typed',
      targetLanguage: 'es',
      version: '1.0.0',
      files: [{ kind: 'items', path: 'items.jsonl' }],
    },
    items: [{ id: ITEM, pack: PACK, type: 'sentence', text: ANSWER, level: 'a1' }],
    lexemes: [],
    senses: [],
    forms: [],
    skills: [],
    translations: [{ ref: ITEM, lang: 'en', text: 'I spoke to my sister yesterday.' }],
    passages: [],
    audio: [],
  };
  return ContentRepository.from([pack]);
}

async function renderCard(): Promise<LearnerStorage> {
  const storage = createMemoryStorage();

  renderWithServices(<SessionScreen />, {
    services: testServices({ repository: onePack(), storage }),
    route: '/es/all/session?preset=writing&size=items:1',
  });

  await screen.findByRole('textbox');
  return storage;
}

describe('the typed-answer card', () => {
  it('accepts the answer and records a production attempt', async () => {
    const user = userEvent.setup();
    const storage = await renderCard();

    await user.type(screen.getByRole('textbox'), ANSWER);
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/correct|bien|eso es/i);

    // The point of the kind: the attempt is evidence of production, and the
    // engine decided that rather than the learner.
    await waitFor(async () => {
      const progress = await storage.progress.get(ITEM);
      expect(progress?.evidence?.production?.correct).toBe(1);
    });
  });

  it('counts a missing accent and still says what was missing', async () => {
    const user = userEvent.setup();
    await renderCard();

    await user.type(screen.getByRole('textbox'), 'Ayer hable con mi hermana');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    // Praise alone would teach that the accents are decoration; marking it wrong
    // would punish somebody who knew the answer and has no accented keyboard.
    expect(await screen.findByRole('status')).toHaveTextContent(`Almost — the accents: ${ANSWER}`);
  });

  it('marks a wrong answer wrong and shows what was wanted', async () => {
    const user = userEvent.setup();
    await renderCard();

    await user.type(screen.getByRole('textbox'), 'no tengo ni idea');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByRole('status')).toHaveTextContent(`Answer: ${ANSWER}`);
  });

  it('will not submit an empty answer', async () => {
    await renderCard();

    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });
});
