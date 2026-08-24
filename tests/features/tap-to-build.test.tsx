/**
 * Building a sentence out of tiles, when the sentence repeats a word.
 *
 * 46 of the pack's 592 sentences say a word twice — `Veo la televisión por la
 * noche.` needs two `la` tiles. The card tracked which tiles were used by their
 * text, so placing one `la` disabled the other, and the sentence could not be
 * finished at all: every attempt was short a word and graded wrong.
 *
 * The tiles are held by position now, which is also what lets punctuation stop
 * being one — see `exercises.test.ts` for the generator's half.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ContentRepository } from '../../src/domain/content';
import type { ContentPack, ItemId, PackId } from '../../src/domain/content';
import { ExerciseEngine, type Answer, type Exercise } from '../../src/domain/exercises';
import { ExerciseView } from '../../src/features/practice/ExerciseView';
import type { SessionRunner } from '../../src/features/practice/useSessionRunner';
import { seededRng } from '../../src/utils/random';
import { id } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

const PACK = id<PackId>('repeat-es');
const ITEM = id<ItemId>('repeat-es:item:001');
const SENTENCE = 'Veo la televisión por la noche.';

const pack: ContentPack = {
  manifest: {
    id: PACK,
    name: 'Repeats',
    targetLanguage: 'es',
    version: '1.0.0',
    files: [{ kind: 'items', path: 'items.jsonl' }],
  },
  items: [
    {
      id: ITEM,
      pack: PACK,
      type: 'sentence',
      text: SENTENCE,
      level: 'a1',
      tokens: [
        { id: 't1', text: 'Veo', pos: 'VERB' },
        { id: 't2', text: 'la', pos: 'DET' },
        { id: 't3', text: 'televisión', pos: 'NOUN' },
        { id: 't4', text: 'por', pos: 'ADP' },
        { id: 't5', text: 'la', pos: 'DET' },
        { id: 't6', text: 'noche', pos: 'NOUN' },
        { id: 't7', text: '.', pos: 'PUNCT' },
      ],
    },
  ],
  lexemes: [],
  senses: [],
  forms: [],
  skills: [],
  translations: [{ ref: ITEM, lang: 'en', text: 'I watch television at night.' }],
  passages: [],
  audio: [],
};

function buildCard() {
  const repository = ContentRepository.from([pack]);
  const item = repository.getItem(ITEM);
  if (!item) throw new Error('missing fixture item');

  const exercise = new ExerciseEngine().generate(item, 'tap-to-build', {
    repository,
    referenceLanguage: 'en',
    rng: seededRng(3),
  });
  if (exercise?.kind !== 'tap-to-build') throw new Error('expected tap-to-build');

  const submitted: Answer[] = [];
  renderWithServices(<ExerciseView exercise={exercise} runner={runner(exercise, submitted)} />, {
    services: testServices({ repository }),
  });
  return { exercise, submitted };
}

function runner(exercise: Exercise, submitted: Answer[]): SessionRunner {
  return {
    status: 'active',
    startedAt: 0,
    durationMs: null,
    exercise,
    item: exercise.item,
    index: 0,
    total: 1,
    stats: { answered: 0, correct: 0 },
    outcome: { advanced: [], lapsed: [] },
    tracked: true,
    lastResult: null,
    submitAnswer: (answer) => {
      submitted.push(answer);
      return null;
    },
    submitGrade: () => {},
    next: () => {},
    previous: () => {},
    restart: () => {},
  };
}

describe('building a sentence that repeats a word', () => {
  it('deals a tile per word and no tile for the full stop', () => {
    const { exercise } = buildCard();

    expect([...exercise.solution]).toEqual(['Veo', 'la', 'televisión', 'por', 'la', 'noche']);
    expect(screen.getAllByRole('button', { name: 'la' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: '.' })).not.toBeInTheDocument();
  });

  it('lets both copies of a repeated word be placed', async () => {
    const user = userEvent.setup();
    const { submitted } = buildCard();

    for (const word of ['Veo', 'la', 'televisión', 'por', 'la', 'noche']) {
      const tiles = screen.getAllByRole('button', { name: word });
      const next = tiles.find((tile) => !(tile as HTMLButtonElement).disabled);
      if (!next) throw new Error(`no tile left for ${word}`);
      await user.click(next);
    }

    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(submitted.at(-1)?.value).toEqual(['Veo', 'la', 'televisión', 'por', 'la', 'noche']);
  });
});
