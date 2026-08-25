/**
 * A headword spread over tokens that need not touch.
 *
 * `look up` is one dictionary entry meaning "search for", and `look it up` puts
 * a pronoun in the middle of it. Spanish never forced the question — the shipped
 * pack has one multi-word lexeme, `por qué`, and it is contiguous — so the model
 * assumed one lexeme per token until 2026-08-25. English breaks that on a word a
 * learner meets in week one, so the span carries the lexeme and the tokens keep
 * their own. See `Annotation.lexeme` and `docs/tasks/language-matrix.md` §4.
 *
 * Nothing reads the field yet. These tests hold the shape so a pack can be
 * authored against it, and so the reference is checked rather than dangling.
 */

import { describe, expect, it } from 'vitest';
import { loadPack, memoryDatasetSource } from '../../src/data/loaders';
import { hasErrors } from '../../src/data/validation';
import type { LearningItem } from '../../src/domain/content';

const manifest = JSON.stringify({
  id: 'test-en',
  name: 'Test',
  targetLanguage: 'en',
  version: '1.0.0',
  files: [
    { kind: 'lexemes', path: 'lexemes.jsonl' },
    { kind: 'items', path: 'items.jsonl' },
  ],
});

const lexemes = [
  '{"id":"test-en:lexeme:look","lemma":"look","pos":"VERB"}',
  '{"id":"test-en:lexeme:up","lemma":"up","pos":"ADP"}',
  '{"id":"test-en:lexeme:look-up","lemma":"look up","pos":"VERB"}',
].join('\n');

/** `look it up` — the phrasal verb with a pronoun inside it. */
const item = {
  id: 'test-en:item:001',
  pack: 'test-en',
  type: 'sentence',
  text: 'I look it up.',
  tokens: [
    { id: 't1', text: 'I', pos: 'PRON' },
    { id: 't2', text: 'look', pos: 'VERB', lexeme: 'test-en:lexeme:look' },
    { id: 't3', text: 'it', pos: 'PRON' },
    { id: 't4', text: 'up', pos: 'ADP', lexeme: 'test-en:lexeme:up' },
    { id: 't5', text: '.' },
  ],
  annotations: [
    {
      tokens: ['t2', 't4'],
      type: 'collocation',
      lexeme: 'test-en:lexeme:look-up',
      label: 'look up',
    },
  ],
};

const load = (items: string) =>
  loadPack(
    memoryDatasetSource({
      'pack.json': manifest,
      'lexemes.jsonl': `${lexemes}\n`,
      'items.jsonl': `${items}\n`,
    }),
    'pack.json',
  );

describe('a multi-word lexeme', () => {
  it('spans tokens that do not touch, and leaves each token its own word', async () => {
    const { pack, issues } = await load(JSON.stringify(item));
    expect(hasErrors(issues)).toBe(false);

    const loaded = pack.items[0] as LearningItem;
    const annotation = loaded.annotations?.[0];
    expect(annotation?.lexeme).toBe('test-en:lexeme:look-up');
    // Discontinuous: t3 (`it`) sits between the two tokens the span names.
    expect(annotation?.tokens).toEqual(['t2', 't4']);

    // The point of putting the headword on the span: tapping `look` still
    // reaches `look`, which pointing the token at the phrasal verb would lose.
    const look = loaded.tokens?.find((token) => token.id === 't2');
    expect(look?.lexeme).toBe('test-en:lexeme:look');
  });

  it('reports a headword no lexeme declares, rather than dangling', async () => {
    const { issues } = await load(
      JSON.stringify({
        ...item,
        annotations: [{ ...item.annotations[0], lexeme: 'test-en:lexeme:missing' }],
      }),
    );

    // A warning, not an error, for the reason a token's is: a pack may carry
    // annotation this version of the app does not resolve.
    expect(hasErrors(issues)).toBe(false);
    expect(issues.map((issue) => issue.message)).toContain(
      'annotation references unknown lexeme test-en:lexeme:missing',
    );
  });

  it('is optional, so every pack authored before it still loads', async () => {
    const { pack, issues } = await load(
      JSON.stringify({
        ...item,
        annotations: [{ tokens: ['t2', 't4'], type: 'construction', label: 'look up' }],
      }),
    );

    expect(hasErrors(issues)).toBe(false);
    expect(pack.items[0]?.annotations?.[0]?.lexeme).toBeUndefined();
  });
});
