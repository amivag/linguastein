import { describe, expect, it } from 'vitest';
import { id, testRepository } from '../fixtures/pack';
import type { ItemId, LexemeId } from '../../src/domain/content';

describe('ContentRepository', () => {
  const repository = testRepository();

  it('indexes items in stable pack order', () => {
    expect(repository.itemCount).toBe(7);
    expect(repository.allItems()[0]?.text).toBe('Tengo que trabajar.');
  });

  it('filters by type, topic and lexeme', () => {
    expect(repository.query({ types: ['word'] })).toHaveLength(4);
    expect(repository.query({ topics: ['food-drink'] })).toHaveLength(4);
    expect(repository.query({ lexemes: [id<LexemeId>('test-es:lexeme:tener')] })).toHaveLength(2);
  });

  it('matches search without diacritics', () => {
    expect(repository.query({ search: 'cafe' })).toHaveLength(1);
    expect(repository.query({ search: 'TIENES' })).toHaveLength(1);
  });

  it('resolves translations through the reference-language fallback chain', () => {
    const item = id<ItemId>('test-es:item:004');
    expect(repository.translationOf(item, 'de')?.text).toBe('Bier');
    // el-GR has no translation: el → en fallback (spec §11.1).
    expect(repository.translationOf(item, 'el-GR')?.text).toBe('beer');
    // No translation at all means target-language-only mode, not a crash.
    expect(repository.translationOf(id<ItemId>('test-es:item:999'), 'en')).toBeUndefined();
  });

  it('picks audio for the preferred pronunciation locale', () => {
    const item = repository.getItem(id<ItemId>('test-es:item:001'));
    expect(item).toBeDefined();
    expect(repository.audioOf(item!, 'es-MX')?.src).toContain('es-MX');
    // Unknown regional variant falls back to another Spanish locale.
    expect(repository.audioOf(item!, 'es-AR')?.locale).toBe('es-ES');
  });

  it('prefers the requested voice within the resolved locale', () => {
    const item = repository.getItem(id<ItemId>('test-es:item:001'))!;

    expect(repository.audioOf(item, 'es-ES', 'luis')?.voice).toBe('luis');
    expect(repository.audioOf(item, 'es-ES', 'ana')?.voice).toBe('ana');
  });

  it('resolves the locale before the voice', () => {
    const item = repository.getItem(id<ItemId>('test-es:item:001'))!;

    // `mateo` only speaks es-MX. Asking for him while aiming at Spain should
    // give a Spanish-of-Spain take, not the wrong accent because a name matched.
    const chosen = repository.audioOf(item, 'es-ES', 'mateo');

    expect(chosen?.locale).toBe('es-ES');
    expect(chosen?.voice).not.toBe('mateo');
  });

  it('falls back rather than going silent when a voice is missing', () => {
    const item = repository.getItem(id<ItemId>('test-es:item:001'))!;

    expect(repository.audioOf(item, 'es-ES', 'nobody')).toBeDefined();
  });

  it('lists every take in a locale, merging clip records with embedded refs', () => {
    const item = repository.getItem(id<ItemId>('test-es:item:001'))!;

    const variants = repository.audioVariantsOf(item, 'es-ES');

    // ana and luis as records, plus the one the item embeds directly.
    expect(variants).toHaveLength(3);
    expect(variants.every((variant) => variant.locale === 'es-ES')).toBe(true);
    expect(variants.map((variant) => variant.voice)).toContain('ana');
  });

  it('has no audio for an item nothing was recorded for', () => {
    const item = repository.getItem(id<ItemId>('test-es:item:002'))!;

    expect(repository.audioOf(item, 'es-ES')).toBeUndefined();
    expect(repository.audioVariantsOf(item, 'es-ES')).toHaveLength(0);
  });

  it('lists the voices a pack ships, narrowed to a locale', () => {
    expect(repository.packVoices().map((voice) => voice.id)).toEqual(['ana', 'luis', 'mateo']);
    expect(repository.packVoices('es-MX').map((voice) => voice.id)).toEqual(['mateo']);
  });

  it('exposes facets for filter UIs', () => {
    const facets = repository.facets();
    expect(facets.types).toEqual(['sentence', 'word']);
    expect(facets.topics).toContain('food-drink');
    expect(facets.levels).toEqual(['a1']);
  });
});

describe('thematic categories', () => {
  const repository = testRepository();

  it('keeps the order the pack declared, not alphabetical order', () => {
    // `colours` is declared last despite sorting first, and the picker's
    // grouping is built straight from this order.
    expect(repository.topics().map((topic) => topic.id)).toEqual([
      'food-drink',
      'work',
      'colours',
      'everyday',
    ]);
  });

  it('carries the label and group a slug alone could not supply', () => {
    const [food] = repository.topics();
    expect(food).toMatchObject({
      id: 'food-drink',
      label: 'Food and drink',
      group: 'Everyday life',
    });
  });

  it('counts the items in each category', () => {
    const counts = new Map(repository.topics().map((topic) => [topic.id, topic.count]));
    expect(counts.get('food-drink')).toBe(4);
    expect(counts.get('work')).toBe(1);
  });

  it('reports a declared but empty category as zero rather than dropping it', () => {
    // A category may be registered before the content that fills it, so the
    // count is what tells a picker to hide it — its absence never does.
    expect(repository.topics().find((topic) => topic.id === 'colours')?.count).toBe(0);
  });

  it('still surfaces a topic the registry does not declare', () => {
    // Content outliving its registry entry must stay browsable, so an
    // undeclared topic falls back to its slug as a label.
    expect(repository.topics().find((topic) => topic.id === 'everyday')).toMatchObject({
      label: 'everyday',
      count: 2,
    });
  });
});

describe('usage filters', () => {
  const repository = testRepository();

  it('filters by register, treating unmarked content as neutral', () => {
    // The fixture marks item 003 colloquial; nothing else carries a register.
    expect(repository.query({ registers: ['colloquial'] }).map((item) => item.text)).toEqual([
      '¿Tienes tiempo?',
    ]);
    expect(repository.query({ registers: ['neutral'] }).length).toBe(repository.itemCount - 1);
  });

  it('narrows to what is said in a region, keeping neutral content', () => {
    const everywhere = repository.query({ usableIn: 'es-MX' });
    expect(everywhere.length).toBe(repository.itemCount);
  });
});

/**
 * "The verbs", "the nouns" — a category of *kind* rather than a list of exact
 * words, which is what makes it something a learner can point at and study a
 * batch of. Resolved through the lexemes an item is annotated with, so a
 * sentence counts as a verb item and a word card counts as its own kind.
 */
describe('word kinds', () => {
  const repository = testRepository();

  it('narrows to the items exemplifying a part of speech', () => {
    expect(repository.query({ pos: ['VERB'] }).map((item) => item.text)).toEqual([
      'Tengo que trabajar.',
      'Tengo que irme.',
    ]);
    expect(repository.query({ pos: ['NOUN'], types: ['word'] }).map((item) => item.text)).toEqual([
      'cerveza',
      'agua',
      'pan',
      'café',
    ]);
  });

  it('ORs several kinds, so a batch can be verbs and nouns at once', () => {
    expect(repository.query({ pos: ['VERB', 'NOUN'] }).length).toBe(6);
  });

  it('counts the kinds on offer and drops the ones that would lead nowhere', () => {
    expect(repository.partsOfSpeech()).toEqual([
      { pos: 'VERB', count: 2 },
      { pos: 'NOUN', count: 4 },
    ]);
  });

  it('counts within the scope it is given, like the categories do', () => {
    expect(repository.partsOfSpeech({ topics: ['food-drink'] })).toEqual([
      { pos: 'NOUN', count: 4 },
    ]);
  });
});
