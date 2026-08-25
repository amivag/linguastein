import { describe, expect, it } from 'vitest';
import {
  ContentRepository,
  searchContent,
  searchFoundNothing,
  type FormId,
  type ItemFilter,
  type ItemId,
  type LexemeId,
  type SearchResults,
} from '../../src/domain/content';
import { id, TEST_PACK, TEST_PACK_ID, testRepository } from '../fixtures/pack';

const repository = testRepository();

const find = (query: string, options: Partial<{ scope: ItemFilter }> = {}): SearchResults =>
  searchContent(repository, query, { referenceLanguage: 'en', ...options });

const lemmas = (results: SearchResults) => results.words.map((word) => word.info.lemma);

describe('searchContent: one word, from either side', () => {
  it('answers a headword typed as itself', () => {
    const [word] = find('cerveza').words;

    expect(word?.info.lemma).toBe('cerveza');
    expect(word?.info.gloss).toBe('beer');
    expect(word?.info.posLabel).toBe('noun');
    expect(word?.info.gender).toBe('feminine');
    expect(word?.match).toEqual({ field: 'word', precision: 'exact' });
  });

  /**
   * The case the app could not answer before this existed: surfaces were only
   * ever resolved at build time, onto tokens, so a *typed* `tengo` reached
   * nothing at all.
   */
  it('resolves an inflected form to its lemma, and says which form was typed', () => {
    const [word] = find('tengo').words;

    expect(word?.info.lemma).toBe('tener');
    expect(word?.match).toEqual({ field: 'form', precision: 'exact', via: 'tengo' });
  });

  it('marks the typed form inside the paradigm, not the lemma', () => {
    const current = find('tuve').words[0]?.info.forms.filter((form) => form.current);

    expect(current?.map((form) => form.form)).toEqual(['tuve']);
  });

  it('folds case and accents, so `cafe` finds `café`', () => {
    expect(lemmas(find('CAFE'))).toContain('café');
  });

  /**
   * Folding has to find `café` from `cafe` and must not invent a second reading:
   * `de` folds onto `dé`, `dar`'s usted command, so `un vaso de agua` answered
   * with the preposition *and* a verb nobody asked about.
   */
  it('drops a reading only reachable by folding an accent away', () => {
    const accented = ContentRepository.from([
      {
        ...TEST_PACK,
        lexemes: [
          ...TEST_PACK.lexemes,
          { id: id<LexemeId>('test-es:lexeme:de'), lemma: 'de', pos: 'ADP', level: 'a1' },
          { id: id<LexemeId>('test-es:lexeme:dar'), lemma: 'dar', pos: 'VERB', level: 'a1' },
        ],
        forms: [
          ...TEST_PACK.forms,
          {
            id: id<FormId>('test-es:form:dar-usted'),
            lexeme: id<LexemeId>('test-es:lexeme:dar'),
            form: 'dé',
            morph: { person: 3, number: 'singular', mood: 'imperative', formality: 'formal' },
          },
        ],
      },
    ]);

    const found = searchContent(accented, 'de', { referenceLanguage: 'en' });
    expect(found.words.map((word) => word.info.lemma)).toEqual(['de']);

    // …and the accented spelling still reaches the verb it belongs to.
    const viaAccent = searchContent(accented, 'dé', { referenceLanguage: 'en' });
    expect(viaAccent.words.map((word) => word.info.lemma)).toContain('dar');
  });

  /**
   * The other direction, and the reason there is no language toggle: a learner
   * types in whichever language the word came to them in, and asking them which
   * one that was is asking them to know the answer before they search.
   */
  it('finds a word through what it means', () => {
    const [word] = find('water').words;

    expect(word?.info.lemma).toBe('agua');
    expect(word?.match).toEqual({ field: 'meaning', precision: 'exact', via: 'water' });
  });

  it('finds a word through a partial, when the learner typed only one thing', () => {
    expect(lemmas(find('cerve'))).toContain('cerveza');
  });

  it('names a term nothing is known for rather than failing silently', () => {
    const results = find('xyzzy');

    expect(searchFoundNothing(results)).toBe(true);
    expect(results.unresolved).toEqual(['xyzzy']);
  });
});

describe('searchContent: several words', () => {
  it('answers each word separately, in the order they were typed', () => {
    const results = find('Tengo que trabajar');

    expect(results.terms).toEqual(['Tengo', 'que', 'trabajar']);
    expect(lemmas(results)).toEqual(['tener']);
    // `que` and `trabajar` are not headwords in this pack, and saying so is the
    // point: a learner is told which of their words the app knows.
    expect(results.unresolved).toEqual(['que', 'trabajar']);
  });

  /**
   * Not "several words, therefore split". `por qué` is one headword spread over
   * two words today, and every English phrasal verb will be — and nothing
   * downstream can put the halves back together once they are two entries.
   */
  it('keeps a multi-word headword whole rather than splitting it', () => {
    const multiWord = ContentRepository.from([
      {
        ...TEST_PACK,
        lexemes: [
          ...TEST_PACK.lexemes,
          { id: id<LexemeId>('test-es:lexeme:por-que'), lemma: 'por qué', pos: 'ADV', level: 'a1' },
        ],
        translations: [
          ...TEST_PACK.translations,
          { ref: 'test-es:lexeme:por-que', lang: 'en', text: 'why' },
        ],
      },
    ]);

    const results = searchContent(multiWord, 'por qué', { referenceLanguage: 'en' });

    expect(results.terms).toEqual(['por qué']);
    expect(results.words.map((word) => word.info.lemma)).toEqual(['por qué']);
  });

  /** Punctuation a learner did not type must not demote an otherwise exact hit. */
  it('reads a quoted question as the headword it is', () => {
    const multiWord = ContentRepository.from([
      {
        ...TEST_PACK,
        lexemes: [
          ...TEST_PACK.lexemes,
          { id: id<LexemeId>('test-es:lexeme:por-que'), lemma: 'por qué', pos: 'ADV', level: 'a1' },
        ],
      },
    ]);

    expect(searchContent(multiWord, '¿por que?', { referenceLanguage: 'en' }).terms).toEqual([
      '¿por que?',
    ]);
  });

  it('does not offer partials for every word of a phrase', () => {
    // `cerve` alone finds `cerveza`; inside a phrase it must not, or one useful
    // answer becomes thirty plausible ones.
    expect(lemmas(find('cerve pan'))).toEqual(['pan']);
  });
});

describe('searchContent: phrases', () => {
  it('shows the sentence itself when the query is one', () => {
    const [phrase] = find('Tengo que trabajar.').phrases;

    expect(phrase?.item.text).toBe('Tengo que trabajar.');
    expect(phrase?.match.precision).toBe('exact');
    expect(phrase?.translation).toBe('I have to work.');
  });

  it('counts a sentence typed without its punctuation as the same sentence', () => {
    expect(find('tengo que trabajar').phrases[0]?.match).toEqual({
      field: 'phrase',
      precision: 'exact',
    });
  });

  it('finds a sentence through its translation', () => {
    const [phrase] = find('I have to work').phrases;

    expect(phrase?.item.text).toBe('Tengo que trabajar.');
    expect(phrase?.match.field).toBe('meaning');
  });

  /** A word card is a word, and belongs in the word entries rather than twice. */
  it('never returns a word card as a phrase', () => {
    expect(find('water').phrases).toEqual([]);
  });

  /**
   * An exact phrase is the *answer*, so it must not come back underneath as an
   * example of each of its own words — once as the result and three more times
   * inside the entries for its verb, its conjunction and its noun.
   */
  it('does not repeat the answer as an example of its own words', () => {
    const results = find('Tengo que trabajar.');
    const answer = results.phrases[0]?.item.id;

    expect(answer).toBeDefined();
    for (const word of results.words) {
      expect(word.info.examples.map((example) => example.id)).not.toContain(answer);
    }
  });

  /** A *partial* phrase match is not the answer, so it stays available as one. */
  it('still uses a loosely matched phrase as an example', () => {
    const results = find('trabajar');
    const shown = results.words.flatMap((word) => word.info.examples.map((e) => e.id));

    // `trabajar` is no headword here, so the phrase pass is the only thing that
    // matched — and nothing was excluded from anybody's examples.
    expect(results.phrases.length).toBeGreaterThan(0);
    expect(shown).toEqual([]);
  });

  /**
   * The same idea running the other way. Every sentence containing `tengo` is
   * both a loose phrase match and an example inside `tener`'s entry, so the two
   * lists were nearly identical and the screen printed each sentence twice.
   */
  it('does not list a phrase the word entry already shows', () => {
    const results = find('tengo');
    const shown = new Set(results.words.flatMap((word) => word.info.examples.map((e) => e.id)));

    expect(shown.size).toBeGreaterThan(0);
    for (const phrase of results.phrases) {
      expect(shown.has(phrase.item.id)).toBe(false);
    }
  });

  /**
   * Keyed on what was shown, not on "one word was typed": a headword whose entry
   * has no examples leaves the phrases as the only answer there is, which is the
   * shipped pack's `por qué` exactly.
   */
  it('keeps the phrases when the headword it found has no examples', () => {
    const orphan = ContentRepository.from([
      {
        ...TEST_PACK,
        lexemes: [
          ...TEST_PACK.lexemes,
          { id: id<LexemeId>('test-es:lexeme:tiempo'), lemma: 'tiempo', pos: 'NOUN', level: 'a1' },
        ],
      },
    ]);

    const results = searchContent(orphan, 'tiempo', { referenceLanguage: 'en' });

    expect(results.words[0]?.info.examples).toEqual([]);
    expect(results.phrases.map((phrase) => phrase.item.text)).toContain('¿Tienes tiempo?');
  });
});

describe('searchContent: where the word is taught', () => {
  const results = find('tener');

  it('offers the passages, patterns and categories its phrases belong to', () => {
    const kinds = new Set(results.destinations.map((entry) => entry.kind));

    expect(kinds).toContain('passage');
    expect(kinds).toContain('skill');
    expect(kinds).toContain('topic');
    expect(kinds).toContain('kind');
  });

  it('labels a destination rather than handing back an id', () => {
    const passage = results.destinations.find((entry) => entry.kind === 'passage');

    expect(passage?.label).toBe('Un día de trabajo');
    expect(passage?.count).toBeGreaterThan(0);
  });

  it('offers nothing at all when the query found no words', () => {
    expect(find('xyzzy').destinations).toEqual([]);
  });

  /** A destination holding nothing is not offered — the rule every tile follows. */
  it('drops a category the matched words have no phrases in', () => {
    const topics = results.destinations
      .filter((entry) => entry.kind === 'topic')
      .map((entry) => entry.ref);

    expect(topics).toContain('work');
    expect(topics).not.toContain('colours');
  });
});

describe('searchContent: scope is a bias, never a filter', () => {
  // Nothing in the fixture is above a1, so an empty pack list is the honest way
  // to ask for a scope that excludes everything.
  const outside: ItemFilter = { packs: [id('other-pack')] };

  it('still answers a word whose every phrase is out of scope', () => {
    const results = find('tener', { scope: outside });

    expect(lemmas(results)).toEqual(['tener']);
    expect(results.words[0]?.beyondScope).toBe(true);
  });

  it('does not mark a word the scope contains', () => {
    const results = find('tener', { scope: { packs: [TEST_PACK_ID] } });

    expect(results.words[0]?.beyondScope).toBe(false);
  });

  /**
   * The shipped pack declares `por qué` with a gloss that no sentence yet
   * references, and reading "nothing in scope uses this" off an empty list
   * called an A1 word out of reach.
   */
  it('does not call a word with no examples at all out of scope', () => {
    const orphan = ContentRepository.from([
      {
        ...TEST_PACK,
        lexemes: [
          ...TEST_PACK.lexemes,
          { id: id<LexemeId>('test-es:lexeme:quizas'), lemma: 'quizás', pos: 'ADV', level: 'a1' },
        ],
      },
    ]);

    const [word] = searchContent(orphan, 'quizás', {
      referenceLanguage: 'en',
      scope: { packs: [TEST_PACK_ID] },
    }).words;

    expect(word?.info.lemma).toBe('quizás');
    expect(word?.info.examples).toEqual([]);
    expect(word?.beyondScope).toBe(false);
  });

  /**
   * A lookup for `tengo` that opened with a sentence using `tiene` answered the
   * right word with the wrong form. Below the scope, though: a level is the
   * standing context, so a form match never promotes something out of it.
   */
  it('leads with the sentences using the form that was typed', () => {
    const examples = find('tengo').words[0]?.info.examples ?? [];

    expect(examples.length).toBeGreaterThan(1);
    // Every sentence containing `Tengo` sits above every one that does not.
    const containsForm = examples.map((example) => (/tengo/i.test(example.text) ? 0 : 1));
    expect(containsForm).toEqual([...containsForm].sort());
    expect(containsForm[0]).toBe(0);
  });

  it('leads with the examples inside the scope without dropping the others', () => {
    const only = id<ItemId>('test-es:item:002');
    const examples = find('tener', { scope: { ids: [only] } }).words[0]?.info.examples ?? [];

    expect(examples[0]?.id).toBe(only);
    // The A1 learner searching a B1 word is why this is an ordering: filtering
    // would answer a real question with an empty list.
    expect(examples.length).toBeGreaterThan(1);
  });

  it('counts destinations with the scope the links will carry', () => {
    const scoped = find('tener', { scope: { ids: [id<ItemId>('test-es:item:001')] } });
    const topics = scoped.destinations
      .filter((entry) => entry.kind === 'topic')
      .map((entry) => entry.ref);

    expect(topics).toEqual(['work']);
  });
});

describe('searchContent: nothing typed', () => {
  it('is empty for an empty query rather than everything', () => {
    for (const query of ['', '   ', '  \n ']) {
      const results = find(query);
      expect(searchFoundNothing(results)).toBe(true);
      expect(results.destinations).toEqual([]);
    }
  });
});
