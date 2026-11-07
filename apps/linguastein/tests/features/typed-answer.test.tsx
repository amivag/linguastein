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
  type LexemeId,
  type PackId,
} from '../../src/domain/content';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { createMemoryStorage, type LearnerStorage } from '../../src/storage';
import { id } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

const PACK = id<PackId>('typed-es');
const ITEM = id<ItemId>('typed-es:item:001');
const ANSWER = 'Ayer hablé con mi hermana.';
const HABLAR = id<LexemeId>('typed-es:lexeme:hablar');

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
const LONG = id<ItemId>('typed-es:item:002');
const LONG_TEXT = 'Ayer por la mañana hablé un rato largo con mi hermana mayor.';

function onePack(withLongSentence = false): ContentRepository {
  const pack: ContentPack = {
    manifest: {
      id: PACK,
      name: 'Typed',
      targetLanguage: 'es',
      version: '1.0.0',
      files: [{ kind: 'items', path: 'items.jsonl' }],
    },
    items: [
      {
        id: ITEM,
        pack: PACK,
        type: 'sentence',
        text: ANSWER,
        level: 'a1',
        // Tokens and forms are what let the card explain a wrong answer rather
        // than only correct it: the token carries the lexeme, the forms carry
        // the morphology the two spellings are compared on.
        tokens: [
          { id: 't1', text: 'Ayer', pos: 'ADV' },
          { id: 't2', text: 'hablé', pos: 'VERB', lemma: 'hablar', lexeme: HABLAR },
          { id: 't3', text: 'con', pos: 'ADP' },
          { id: 't4', text: 'mi', pos: 'DET' },
          { id: 't5', text: 'hermana', pos: 'NOUN' },
          { id: 't6', text: '.', pos: 'PUNCT' },
        ],
      },
      // Eleven words: over TYPE_IT_MAX_WORDS, so `type-it` declines it.
      ...(withLongSentence
        ? [
            {
              id: LONG,
              pack: PACK,
              type: 'sentence' as const,
              text: LONG_TEXT,
              level: 'a1' as const,
            },
          ]
        : []),
    ],
    lexemes: [{ id: HABLAR, lemma: 'hablar', pos: 'VERB' }],
    senses: [],
    forms: [
      {
        id: id('typed-es:form:hable'),
        lexeme: HABLAR,
        form: 'hablé',
        morph: { person: 1, number: 'singular', tense: 'preterite', mood: 'indicative' },
      },
      {
        id: id('typed-es:form:hablo'),
        lexeme: HABLAR,
        form: 'hablo',
        morph: { person: 1, number: 'singular', tense: 'present', mood: 'indicative' },
      },
    ],
    skills: [],
    translations: [
      { ref: ITEM, lang: 'en', text: 'I spoke to my sister yesterday.' },
      { ref: LONG, lang: 'en', text: 'Yesterday morning I spoke at length with my older sister.' },
    ],
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

  it('names the axis that slipped, not only the answer', async () => {
    const user = userEvent.setup();
    await renderCard();

    await user.type(screen.getByRole('textbox'), 'Ayer hablo con mi hermana');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    const verdict = await screen.findByRole('status');
    expect(verdict).toHaveTextContent(`Answer: ${ANSWER}`);
    expect(verdict).toHaveTextContent('Wrong tense: hablo is present, hablé is preterite.');
  });

  it('says only what it can about a wrong answer it cannot place', async () => {
    const user = userEvent.setup();
    await renderCard();

    // Two words differ, so there is no single substitution to explain — the card
    // corrects without diagnosing rather than guessing at one.
    await user.type(screen.getByRole('textbox'), 'Hoy hablo con mi hermana');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    const verdict = await screen.findByRole('status');
    expect(verdict).toHaveTextContent(`Answer: ${ANSWER}`);
    expect(verdict).not.toHaveTextContent(/Wrong /);
  });

  /**
   * The planner chooses from content and knows nothing about exercises, so a
   * preset allowing one kind can be dealt an item that kind declines — and the
   * card then reads "This item has no exercise available yet". Reachable before
   * this kind existed; `Write it` is what made it ordinary, because the length
   * ceiling refuses about one sentence in eight.
   */
  it('deals only the items it can actually ask about', async () => {
    renderWithServices(<SessionScreen />, {
      services: testServices({ repository: onePack(true), storage: createMemoryStorage() }),
      route: '/es/all/session?preset=writing&size=items:2',
    });

    await screen.findByRole('textbox');
    // Both items are in the pack and both were asked for; only one is askable,
    // so the session is one card long rather than two with a dead turn in it.
    expect(screen.getByText('1/1')).toBeInTheDocument();
    expect(screen.queryByText(/no exercise available/)).not.toBeInTheDocument();
  });

  it('will not submit an empty answer', async () => {
    await renderCard();

    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });
});
