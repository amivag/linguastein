import { describe, expect, it } from 'vitest';
import { id, TEST_PACK, testRepository } from '../fixtures/pack';
import { ContentRepository, moodOf, sentenceMood } from '../../src/domain/content';
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

  /**
   * The count a region picker needs is *not* what the filter returns.
   *
   * Region-neutral content is usable everywhere, so the assertion above is the
   * whole problem: filtering to Mexico passes the entire pack. A picker counting
   * that way finds every region equally full and offers Argentina as a live
   * option when nothing in the pack is Argentinian — a filter that silently does
   * nothing, which reads as "all of this is Argentinian".
   */
  it('counts only what is specifically marked for a region', () => {
    const offered = ['es-ES', 'es-419', 'es-MX', 'es-AR'];
    const facets = repository.regions({}, offered);

    // The fixture marks nothing by region, so a picker built from this offers
    // nothing rather than five options that all mean "everything".
    expect(facets).toEqual([]);
  });

  it('reports a macro-region against the locales it covers', () => {
    const marked = ContentRepository.from([
      {
        ...TEST_PACK,
        items: TEST_PACK.items.map((item, index) =>
          index === 0 ? { ...item, regions: ['es-419'] } : item,
        ),
      },
    ]);

    // `papa` marked `es-419` is the word a learner aiming at Mexico wants, so it
    // counts towards Mexico — exactly as it counts when the filter runs.
    expect(marked.regions({}, ['es-419', 'es-MX', 'es-ES'])).toEqual([
      { locale: 'es-419', count: 1 },
      { locale: 'es-MX', count: 1 },
    ]);
  });
});

/**
 * Asking versus telling, which the pack could not express at all before: the
 * `questions` topic is a *subject* and covers under half of the actual questions,
 * because whether a sentence asks is a form.
 */
describe('sentence mood', () => {
  const repository = testRepository();

  it('derives the mood from the punctuation Spanish requires', () => {
    expect(sentenceMood('¿Tienes tiempo?')).toBe('question');
    expect(sentenceMood('Tengo que trabajar.')).toBe('statement');
    expect(sentenceMood('¡Qué bien!')).toBe('exclamation');
  });

  it('reads the opening mark, so a question keeps its mood however it ends', () => {
    // `¿Pero qué haces!` is a question written with an exclamation: the mark that
    // classifies it is the one Spanish puts where English has nothing.
    expect(sentenceMood('¿Pero qué haces!')).toBe('question');
    expect(sentenceMood('¡Qué haces aquí?')).toBe('exclamation');
  });

  it('gives a word card no mood at all', () => {
    // A card reading `cerveza` is not a statement, and counting it as one would
    // file every word card under "statements" and make the facet meaningless.
    const card = repository.getItem(id<ItemId>('test-es:item:004'))!;
    expect(moodOf(card)).toBeUndefined();
    expect(repository.query({ moods: ['statement'] }).some((item) => item.type === 'word')).toBe(
      false,
    );
  });

  it('narrows to the questions', () => {
    expect(repository.query({ moods: ['question'] }).map((item) => item.text)).toEqual([
      '¿Tienes tiempo?',
    ]);
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

/**
 * Letters: the alphabetical way into a long list, counted from the pack itself
 * for the reason the categories are — a row of every letter offers taps that
 * lead nowhere, and one that is derived grows a K the day a K word exists.
 */
describe('letters', () => {
  const repository = testRepository();

  it('narrows to the items filing under one letter', () => {
    expect(repository.query({ initial: 'c' }).map((item) => item.text)).toEqual([
      'cerveza',
      'café',
    ]);
  });

  it('takes the letter as a bucket, not as a prefix', () => {
    // `¿Tienes tiempo?` files under T, so a T that missed it would be a letter
    // index disagreeing with the list it indexes.
    expect(repository.query({ initial: 'T' })).toHaveLength(3);
    // Whatever a link happens to carry means the letter it starts with.
    expect(repository.query({ initial: 'café' })).toHaveLength(2);
  });

  it('lists the letters in scope, collated in the language and counted', () => {
    expect(repository.initials({}, 'es')).toEqual([
      { letter: 'A', count: 1 },
      { letter: 'C', count: 2 },
      { letter: 'P', count: 1 },
      { letter: 'T', count: 3 },
    ]);
  });

  it('counts within the scope it is given, like the categories do', () => {
    expect(repository.initials({ types: ['word'] }, 'es')).toEqual([
      { letter: 'A', count: 1 },
      { letter: 'C', count: 2 },
      { letter: 'P', count: 1 },
    ]);
  });
});

/**
 * Skills are how the pack names a tense: `preterite` and `imperfect` are
 * attached to the sentences that use them, so resolving a slug to a skill is
 * what turns "practise the past" into a query. Local ids for the reason
 * passages use them — a URL should not carry a pack namespace it will outlive.
 */
describe('skills', () => {
  const repository = testRepository();

  it('lists what the loaded packs teach', () => {
    expect(repository.allSkills().map((skill) => skill.label)).toEqual(['tener que + infinitivo']);
  });

  it('resolves the local part of a skill id, as a route carries it', () => {
    expect(repository.skillByLocalId('tener-que')?.id).toBe('test-es:skill:tener-que');
    expect(repository.skillByLocalId('nope')).toBeUndefined();
  });

  it('does not match a local id by suffix alone', () => {
    // `que` ends `tener-que`, but it is not the local id — `endsWith` has to be
    // anchored on the `:skill:` separator or a short slug matches the wrong row.
    expect(repository.skillByLocalId('que')).toBeUndefined();
  });

  it('narrows to the items a skill is attached to', () => {
    const skill = repository.skillByLocalId('tener-que');
    expect(skill).toBeDefined();
    expect(repository.query({ skills: [skill!.id] }).map((item) => item.text)).toEqual([
      'Tengo que trabajar.',
    ]);
  });

  it('treats an empty skill list as no constraint, like every other facet', () => {
    expect(repository.query({ skills: [] }).length).toBe(repository.query().length);
  });
});
