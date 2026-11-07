/**
 * Lookup: what one typed word or phrase means, where it is used, and where in
 * the app it is taught.
 *
 * Deliberately not the same thing as `ItemFilter.search`, which narrows a sheet
 * of practisable cards and answers "which of these match". This answers "what is
 * this", which is a question about the language rather than about a list — so it
 * resolves headwords, keeps every reading of an ambiguous surface, and hands back
 * routes out rather than rows.
 *
 * Pure derivation over records already in memory (Rule 1): no index ships in the
 * pack, no build step changes, and `repository.lexemesOfSurface` is the one new
 * read it needed. The passes below scan — a few thousand items and translations
 * per query — which is honest at this size and is the first thing to revisit if a
 * pack ever grows large enough to feel it.
 */

import { STUDYABLE_POS, type PartOfSpeech } from './annotation';
import { POS_LABELS, inspectLexeme, isInspectableItem, type WordInfo } from './inspect';
import { parseEntityId, type ItemId, type LexemeId, type PassageId, type SkillId } from './ids';
import type { LanguageTag } from './language';
import type { LearningItem } from './model';
import { normalise, splitWords, type ContentRepository, type ItemFilter } from './repository';

/** Which of a word's several written faces the query actually hit. */
export const SEARCH_FIELDS = ['word', 'form', 'meaning', 'phrase'] as const;
export type SearchField = (typeof SEARCH_FIELDS)[number];

export interface SearchMatch {
  readonly field: SearchField;
  /** Whether the query *was* the surface, or merely appears inside it. */
  readonly precision: 'exact' | 'partial';
  /**
   * The text that matched, where it is not the headword itself: `tengo` for
   * `tener`, or the English gloss for a reverse lookup.
   *
   * Shown rather than kept for ranking. A learner who typed `fui` and is handed
   * `ir` has been given a correct answer that looks like a wrong one, and the
   * only thing that closes the gap is saying which form they wrote.
   */
  readonly via?: string;
}

/** One headword the query resolved to, with its whole dictionary entry. */
export interface WordResult {
  readonly lexeme: LexemeId;
  /**
   * The word of the query this answers.
   *
   * A phrase is answered word by word — `tengo que trabajar` is three entries —
   * so a result has to say which of them it belongs to, or a learner reading a
   * flat list cannot tell a second reading of one word from the next word along.
   */
  readonly term: string;
  readonly info: WordInfo;
  /** The word card for this lexeme, where the pack has one: somewhere to practise it. */
  readonly card?: ItemId;
  /**
   * How many phrases use this word in total, against the {@link WordInfo.examples}
   * actually carried.
   *
   * Here so a screen showing five of them can say so. A list that silently stops
   * at its cap reads as the whole of what exists — the failure `log()`ing a
   * dropped tail exists to prevent — and "show more" is a promise a component
   * cannot keep without knowing whether there is more.
   */
  readonly exampleTotal: number;
  readonly match: SearchMatch;
  /**
   * True when nothing this word appears in is inside the current scope.
   *
   * Returned and marked rather than dropped. "No results" cannot tell a learner
   * whether a word is absent from the packs or merely above their level, and
   * those have different answers — the argument `NotFoundScreen` makes for
   * quoting the address back, and the Packs section for naming a missing pack.
   */
  readonly beyondScope: boolean;
}

/** One phrase whose own text — or whose translation — is what matched. */
export interface PhraseResult {
  readonly item: LearningItem;
  readonly translation?: string;
  readonly match: SearchMatch;
  readonly beyondScope: boolean;
}

/**
 * Somewhere in the app that teaches the words the query found.
 *
 * A flat list of (kind, ref, label, count) rather than a shape per kind, so a
 * screen groups and links them and a new kind needs no new field. Missions are
 * deliberately absent: a mission points at a *passage*, so `domain/missions`
 * derives them from the passages here rather than content learning what a
 * mission is.
 */
export const SEARCH_DESTINATION_KINDS = ['passage', 'skill', 'topic', 'kind'] as const;
export type SearchDestinationKind = (typeof SEARCH_DESTINATION_KINDS)[number];

export interface SearchDestination {
  readonly kind: SearchDestinationKind;
  /** A passage id, a skill id, a topic slug, or a part-of-speech tag. */
  readonly ref: string;
  readonly label: string;
  /** How many of the matched words' phrases this destination holds. */
  readonly count: number;
}

export interface SearchResults {
  /** The query as typed, so a screen can quote it back. */
  readonly query: string;
  /** The words it was read as, in order. */
  readonly terms: readonly string[];
  readonly words: readonly WordResult[];
  readonly phrases: readonly PhraseResult[];
  readonly destinations: readonly SearchDestination[];
  /** Terms no loaded pack has anything for, named so the screen can say which. */
  readonly unresolved: readonly string[];
}

export interface SearchOptions {
  /** The language a learner's own half of the search is written in. */
  readonly referenceLanguage: LanguageTag;
  /**
   * What counts as in scope — the course today.
   *
   * An `ItemFilter` rather than a course, which is where the flexibility of this
   * function lives: searching inside one Study section, one category or one part
   * of speech is this same call with a narrower filter and needs no second code
   * path. It biases and marks; it never removes a headword, for the reason
   * {@link WordResult.beyondScope} gives.
   */
  readonly scope?: ItemFilter;
  readonly maxWords?: number;
  readonly maxPhrases?: number;
  readonly maxExamples?: number;
  readonly maxDestinations?: number;
}

interface SearchLimits {
  readonly maxWords: number;
  readonly maxPhrases: number;
  readonly maxExamples: number;
  readonly maxDestinations: number;
}

/**
 * Five examples, because that is what fits before a word entry stops being an
 * entry and starts being a list. The rest are reachable through the destinations
 * and through Browse, which is the screen for a list.
 */
const DEFAULTS: SearchLimits = {
  maxWords: 12,
  maxPhrases: 24,
  maxExamples: 5,
  maxDestinations: 8,
};

const EMPTY_RESULTS: SearchResults = {
  query: '',
  terms: [],
  words: [],
  phrases: [],
  destinations: [],
  unresolved: [],
};

/**
 * A phrase reduced to its words, for deciding whether two are the *same* phrase.
 *
 * Nobody types `¿Dónde está el baño?` with both marks, and a learner who typed
 * the sentence correctly should not be handed a partial match for it. So an
 * exact comparison is made on the words and a loose one on the raw text —
 * `splitWords` is the app's one definition of where a word ends, and reusing it
 * means a `¡` missing from that class cannot be missing from only this screen.
 */
function phraseKey(text: string): string {
  return splitWords(normalise(text)).join(' ');
}

/** True when a query found nothing at all — the one state worth its own name. */
export function searchFoundNothing(results: SearchResults): boolean {
  return results.words.length === 0 && results.phrases.length === 0;
}

export function searchContent(
  repository: ContentRepository,
  query: string,
  options: SearchOptions,
): SearchResults {
  const text = normalise(query);
  if (!text) return EMPTY_RESULTS;

  const limits: SearchLimits = {
    maxWords: options.maxWords ?? DEFAULTS.maxWords,
    maxPhrases: options.maxPhrases ?? DEFAULTS.maxPhrases,
    maxExamples: options.maxExamples ?? DEFAULTS.maxExamples,
    maxDestinations: options.maxDestinations ?? DEFAULTS.maxDestinations,
  };
  const language = options.referenceLanguage;
  // Once, not per result: every pass below asks "is this in scope", and asking
  // the repository each time would scan the pack once per matched word.
  const inScope = options.scope
    ? new Set(repository.query(options.scope).map((item) => item.id))
    : undefined;

  const terms = termsOf(repository, query);
  // Phrases first, because an exact one is the *answer* to what was typed and so
  // must not be repeated underneath as an example of each of its own words.
  // Searching a whole sentence otherwise showed it once as the result and three
  // times more inside the entries for its verb, its conjunction and its noun.
  const matched = resolvePhrases(repository, text, language, inScope, limits.maxPhrases);
  const answered = new Set(
    matched.filter((phrase) => phrase.match.precision === 'exact').map((phrase) => phrase.item.id),
  );
  const words = resolveWords(repository, terms, text, language, inScope, limits, answered);

  /**
   * And the other half of the same idea, running the other way.
   *
   * A one-word query makes the two lists nearly the same thing: every sentence
   * containing `tengo` is a loose phrase match *and* an example inside `tener`'s
   * own entry, so the screen printed each of them twice under two headings. The
   * word entry owns them — it is the more specific answer — so a loose phrase is
   * dropped once it has already appeared there.
   *
   * Keyed on what was actually shown rather than on "the query was one word",
   * because those come apart: `por qué` is a single headword whose entry has no
   * examples at all, and the phrases are then the only answer there is.
   */
  const shown = new Set(
    words.results.flatMap((result) => result.info.examples.map((example) => example.id)),
  );
  const phrases = matched.filter(
    (phrase) => phrase.match.precision === 'exact' || !shown.has(phrase.item.id),
  );

  return {
    query,
    terms,
    words: words.results,
    phrases,
    destinations: destinationsOf(
      repository,
      words.results.map((result) => result.lexeme),
      options.scope,
      inScope,
      limits.maxDestinations,
    ),
    unresolved: words.unresolved,
  };
}

/**
 * The words a query is read as — and the point at which "several words" stops
 * being one case.
 *
 * Three outcomes, not two. The whole string may be a single headword, which is
 * what `por qué` is today and what every English phrasal verb will be; it may be
 * several words, which is the ordinary case; and it may be neither, which is a
 * phrase and belongs to {@link resolvePhrases} rather than here. Splitting first
 * would break the first case irreparably: nothing downstream can put `por` and
 * `qué` back together once they are two entries.
 */
function termsOf(repository: ContentRepository, query: string): readonly string[] {
  // Through `phraseKey`, so `¿por qué?` reaches the headword `por qué` — a
  // learner quoting a question mid-sentence has typed the punctuation with it.
  if (repository.lexemesOfSurface(phraseKey(query)).length > 0) return [query.trim()];
  const words = splitWords(query);
  return words.length > 0 ? words : [query.trim()];
}

interface ResolvedWords {
  readonly results: readonly WordResult[];
  readonly unresolved: readonly string[];
}

function resolveWords(
  repository: ContentRepository,
  terms: readonly string[],
  whole: string,
  language: LanguageTag,
  inScope: ReadonlySet<ItemId> | undefined,
  limits: SearchLimits,
  answered: ReadonlySet<ItemId>,
): ResolvedWords {
  const results: WordResult[] = [];
  const unresolved: string[] = [];
  const seen = new Set<string>();
  // A partial is only offered when the learner typed one thing. Prefix-matching
  // each word of a five-word sentence turns one useful answer into thirty
  // plausible ones, and the phrase pass already covers what they meant.
  const single = terms.length === 1;

  terms.forEach((term, index) => {
    const matches = candidatesFor(repository, term, language, single);
    if (matches.length === 0) {
      unresolved.push(term);
      return;
    }

    for (const candidate of matches) {
      // A word answers once per term: a lemma reached through both its own
      // spelling and one of its glosses is not two words.
      const key = `${index}:${candidate.lexeme}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const info = inspectLexeme(repository, candidate.lexeme, language, {
        surface: candidate.surface ?? term,
        maxExamples: limits.maxExamples,
        exclude: answered,
        ...(inScope ? { scope: inScope } : {}),
      });
      if (!info) continue;

      const items = repository.itemsOfLexeme(candidate.lexeme);
      const card = items.find((item) => isInspectableItem(item));
      results.push({
        lexeme: candidate.lexeme,
        term,
        info,
        // Counted the way `examplesOf` selects: phrases only, since a word card
        // is the word rather than an example of it, and minus anything already
        // shown above as the answer.
        exampleTotal: items.filter((item) => item.type !== 'word' && !answered.has(item.id)).length,
        match: candidate.match,
        // `items.length > 0` is load-bearing. The shipped pack declares `por
        // qué` as a headword with a gloss that no sentence yet references, and
        // reading "nothing in scope uses this" off an empty list called an A1
        // word out of reach. Nothing to be beyond is not the same as beyond.
        beyondScope:
          inScope !== undefined && items.length > 0 && !items.some((item) => inScope.has(item.id)),
        ...(card ? { card: card.id } : {}),
      });
    }
  });

  return { results: rank(repository, results, terms, whole).slice(0, limits.maxWords), unresolved };
}

interface Candidate {
  readonly lexeme: LexemeId;
  readonly match: SearchMatch;
  /** The written form to show the paradigm against, when the query was one. */
  readonly surface?: string;
}

/**
 * Every reading of one term, both directions at once.
 *
 * Both, and never one or the other. A learner types in whichever language the
 * word came to them in, and asking them to say which — a toggle, a mode, a guess
 * from the characters — is asking them to know the answer before they search.
 * `agua` and `water` are the same lookup from opposite ends.
 */
function candidatesFor(
  repository: ContentRepository,
  term: string,
  language: LanguageTag,
  allowPartial: boolean,
): readonly Candidate[] {
  const key = normalise(term);
  if (!key) return [];

  const surfaces: Candidate[] = [];

  for (const lexeme of repository.lexemesOfSurface(phraseKey(term))) {
    const lemma = repository.getLexeme(lexeme)?.lemma;
    // Which face was hit decides what the screen says, so it is recorded rather
    // than inferred later: `tener` reached through `tengo` needs the form named.
    const isLemma = lemma !== undefined && normalise(lemma) === key;
    surfaces.push({
      lexeme,
      surface: term,
      match: isLemma
        ? { field: 'word', precision: 'exact' }
        : { field: 'form', precision: 'exact', via: term },
    });
  }

  /**
   * A word spelled the way it was typed beats one only reachable by folding an
   * accent off.
   *
   * Folding is what makes `cafe` find `café`, and it has to stay. But it also
   * makes `de` find `dé` — `dar`'s usted command — so `un vaso de agua` answered
   * with the preposition *and* a verb nobody asked about. That is not the
   * ambiguity the list exists for: `de` and `dé` are two spellings, while `entre`
   * the preposition and `entre` from `entrar` are one, and only the second is a
   * genuine choice a reader has to make.
   *
   * So a folded match survives only where nothing matches exactly. `entre` and
   * `fui` keep both readings; `cafe` still finds `café`.
   */
  const spelled = surfaces.filter((candidate) => spellsExactly(repository, candidate.lexeme, term));
  const exact = spelled.length > 0 ? spelled : surfaces;

  for (const candidate of meaningMatches(repository, key, language, 'exact')) exact.push(candidate);
  if (exact.length > 0) return exact;
  if (!allowPartial) return [];

  const partial: Candidate[] = [];
  for (const lexeme of repository.allLexemes()) {
    if (normalise(lexeme.lemma).includes(key)) {
      partial.push({ lexeme: lexeme.id, match: { field: 'word', precision: 'partial' } });
    }
  }
  for (const candidate of meaningMatches(repository, key, language, 'partial')) {
    partial.push(candidate);
  }
  return partial;
}

/**
 * Whether a lexeme has a surface spelled exactly as typed, accents and all.
 *
 * Case is still folded — nobody expects `Cerveza` to be a different word — but
 * diacritics are not, because in Spanish they are what tells two words apart.
 */
function spellsExactly(repository: ContentRepository, lexeme: LexemeId, term: string): boolean {
  const wanted = term.trim().toLowerCase();
  if (repository.getLexeme(lexeme)?.lemma.toLowerCase() === wanted) return true;
  return repository.formsOf(lexeme).some((form) => form.form.toLowerCase() === wanted);
}

/**
 * The reverse direction: a lexeme reached through what it means.
 *
 * Glosses live on the lexeme for most of the shipped pack's words and on a word
 * card for the rest — `glossOf` already reads both, so a reverse lookup has to
 * accept both refs or part of the vocabulary is unreachable from English.
 */
function meaningMatches(
  repository: ContentRepository,
  key: string,
  language: LanguageTag,
  precision: 'exact' | 'partial',
): readonly Candidate[] {
  const found: Candidate[] = [];

  for (const translation of repository.translationsIn(language)) {
    const value = normalise(translation.text);
    if (precision === 'exact' ? value !== key : !value.includes(key)) continue;

    const parsed = parseEntityId(translation.ref);
    if (!parsed) continue;

    if (parsed.kind === 'lexeme') {
      found.push({
        lexeme: translation.ref as LexemeId,
        match: { field: 'meaning', precision, via: translation.text },
      });
      continue;
    }
    // A word card's gloss is the word's gloss. A *sentence*'s translation is not
    // any one of its words' meanings, so only cards are followed here — the
    // phrase pass is where a matching sentence belongs.
    if (parsed.kind !== 'item') continue;
    const item = repository.getItem(translation.ref as ItemId);
    if (!item || !isInspectableItem(item)) continue;
    const lexeme = item.lexemes?.[0];
    if (lexeme) {
      found.push({ lexeme, match: { field: 'meaning', precision, via: translation.text } });
    }
  }

  return found;
}

/**
 * Phrases the query is *of*, rather than words it is made of.
 *
 * Kept separate from the word entries because they answer different questions.
 * Typing a whole sentence should show that sentence, not a lecture on each of its
 * words — and typing one word should show the word, with the sentences using it
 * already inside its entry as examples.
 */
function resolvePhrases(
  repository: ContentRepository,
  text: string,
  language: LanguageTag,
  inScope: ReadonlySet<ItemId> | undefined,
  limit: number,
): readonly PhraseResult[] {
  const found: PhraseResult[] = [];

  const wanted = phraseKey(text);

  for (const item of repository.allItems()) {
    if (item.type === 'word') continue;
    const own = normalise(item.text);
    const translation = repository.translationOf(item.id, language)?.text;
    const meaning = translation ? normalise(translation) : undefined;

    const match: SearchMatch | undefined =
      phraseKey(own) === wanted
        ? { field: 'phrase', precision: 'exact' }
        : meaning !== undefined && translation !== undefined && phraseKey(meaning) === wanted
          ? { field: 'meaning', precision: 'exact', via: translation }
          : own.includes(text)
            ? { field: 'phrase', precision: 'partial' }
            : meaning?.includes(text) && translation !== undefined
              ? { field: 'meaning', precision: 'partial', via: translation }
              : undefined;
    if (!match) continue;

    found.push({
      item,
      match,
      beyondScope: inScope ? !inScope.has(item.id) : false,
      ...(translation ? { translation } : {}),
    });
  }

  // Exact before partial, in scope before out of it, pack order within — the
  // same keys the word entries sort on, so the two lists read alike.
  return found
    .slice()
    .sort(
      (a, b) =>
        rankPrecision(a.match) - rankPrecision(b.match) ||
        Number(a.beyondScope) - Number(b.beyondScope),
    )
    .slice(0, limit);
}

/**
 * Where the found words are taught.
 *
 * Counted over the phrases those words appear in, and counted with the scope the
 * links will carry — the rule the Study tiles are built on, after a count taken
 * with a wider filter than the sheet it opened advertised 546 verbs where the
 * sheet listed none. A destination holding nothing is not returned, which is the
 * same reason an empty category is not offered.
 */
function destinationsOf(
  repository: ContentRepository,
  lexemes: readonly LexemeId[],
  scope: ItemFilter | undefined,
  inScope: ReadonlySet<ItemId> | undefined,
  limit: number,
): readonly SearchDestination[] {
  const wanted = contentWords(repository, lexemes);
  if (wanted.size === 0) return [];

  const items = new Map<ItemId, LearningItem>();
  for (const lexeme of wanted) {
    for (const item of repository.itemsOfLexeme(lexeme)) {
      if (inScope && !inScope.has(item.id)) continue;
      items.set(item.id, item);
    }
  }
  if (items.size === 0) return [];

  const skills = new Map<SkillId, number>();
  const topics = new Map<string, number>();
  const passages = new Map<PassageId, number>();
  const kinds = new Map<PartOfSpeech, number>();

  for (const item of items.values()) {
    for (const skill of item.skills ?? []) bump(skills, skill);
    for (const topic of item.topics ?? []) bump(topics, topic);
    for (const passage of repository.passagesOfItem(item.id)) bump(passages, passage.id);
    for (const lexeme of item.lexemes ?? []) {
      if (!wanted.has(lexeme)) continue;
      const pos = repository.getLexeme(lexeme)?.pos;
      if (pos) bump(kinds, pos);
    }
  }

  const topicLabels = new Map(
    repository.topics(scope ?? {}).map((facet) => [facet.id, facet.label]),
  );

  return [
    ...named(passages, 'passage', (id) => repository.getPassage(id)?.title),
    ...named(skills, 'skill', (id) => repository.getSkill(id)?.label),
    ...named(topics, 'topic', (slug) => topicLabels.get(slug) ?? slug.replace(/-/g, ' ')),
    ...named(kinds, 'kind', (pos) => POS_LABELS[pos]),
  ]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * The words worth routing from, which is not every word that matched.
 *
 * `¿Dónde está el baño?` resolves five headwords, and `el` alone is in 619 of the
 * course's sentences — so counting destinations over all five buried "At home"
 * and the bathroom passages under "determiner (619)". A destination is a claim
 * that somewhere teaches this, and no screen teaches `el`.
 *
 * {@link STUDYABLE_POS} is the existing answer to which kinds a learner asks
 * for, and its comment says why `de` and `el` are not among them. The fallback
 * matters though: a learner who searched only `el` should still be shown where
 * it turns up, because then it is what they asked about.
 */
function contentWords(
  repository: ContentRepository,
  lexemes: readonly LexemeId[],
): ReadonlySet<LexemeId> {
  const studyable = lexemes.filter((lexeme) => {
    const pos = repository.getLexeme(lexeme)?.pos;
    return pos !== undefined && (STUDYABLE_POS as readonly string[]).includes(pos);
  });
  return new Set(studyable.length > 0 ? studyable : lexemes);
}

/** One kind's counts as destinations, dropping any whose label no longer resolves. */
function named<K extends string>(
  counts: ReadonlyMap<K, number>,
  kind: SearchDestinationKind,
  label: (ref: K) => string | undefined,
): readonly SearchDestination[] {
  return [...counts]
    .map(([ref, count]): SearchDestination | undefined => {
      const text = label(ref);
      return text === undefined ? undefined : { kind, ref, label: text, count };
    })
    .filter((entry): entry is SearchDestination => entry !== undefined);
}

function bump<K>(counts: Map<K, number>, key: K): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/**
 * Query order first, then confidence.
 *
 * The term index leads because a multi-word query is read left to right, and a
 * list that put every exact match above every partial one would interleave the
 * words of a sentence — `trabajar` above `que` above `tener`. Within one term:
 * how the word was reached, then whether it is in scope, then how common it is,
 * so an ambiguous surface deals its likelier reading first.
 */
function rank(
  repository: ContentRepository,
  results: readonly WordResult[],
  terms: readonly string[],
  whole: string,
): readonly WordResult[] {
  const position = new Map(terms.map((term, index) => [term, index]));
  const key = (result: WordResult) => {
    const lexeme = repository.getLexeme(result.lexeme);
    return [
      position.get(result.term) ?? 0,
      rankPrecision(result.match),
      Number(result.beyondScope),
      // A word the learner typed whole outranks one merely containing it.
      normalise(lexeme?.lemma ?? '') === whole ? 0 : 1,
      lexeme?.frequencyRank ?? Number.MAX_SAFE_INTEGER,
    ];
  };

  return results.slice().sort((a, b) => {
    const left = key(a);
    const right = key(b);
    for (let index = 0; index < left.length; index += 1) {
      const difference = (left[index] ?? 0) - (right[index] ?? 0);
      if (difference !== 0) return difference;
    }
    return 0;
  });
}

/** The word's own spelling, then a form of it, then what it means — then anything partial. */
const FIELD_ORDER: Record<SearchField, number> = { word: 0, form: 1, phrase: 1, meaning: 2 };

function rankPrecision(match: SearchMatch): number {
  return (match.precision === 'exact' ? 0 : 10) + FIELD_ORDER[match.field];
}
