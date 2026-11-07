/**
 * Word inspection: everything the app knows about one token of a phrase.
 *
 * This is pure derivation from stored content — meaning, grammar, the
 * construction the word takes part in, its other forms, and other phrases that
 * use it. Nothing here is stored per token; it is assembled on demand from the
 * lexeme, inflected-form, skill and translation records (spec §13, §14, §15).
 */

import type { Gender, Morphology, PartOfSpeech, Token, TokenId } from './annotation';
import type { ItemId, LexemeId, SkillId } from './ids';
import type { LanguageTag } from './language';
import type { LearningItem, Register } from './model';
import type { ContentRepository } from './repository';
import { normalise } from './repository';

export interface WordConstruction {
  readonly skill?: SkillId;
  readonly label: string;
  /** Reference-language explanation, when the dataset has one. */
  readonly gloss?: string;
}

export interface WordForm {
  readonly form: string;
  /** Human-readable morphology, e.g. `2nd sg · present`. */
  readonly label: string;
  /** True for the form that appears in the phrase being inspected. */
  readonly current: boolean;
}

export interface WordExample {
  readonly id: ItemId;
  readonly text: string;
  readonly translation?: string;
}

export interface WordInfo {
  readonly token: Token;
  readonly lexeme?: LexemeId;
  readonly lemma?: string;
  readonly pos?: PartOfSpeech;
  readonly posLabel?: string;
  /**
   * The word's own gender, where it has one.
   *
   * Separate from {@link grammar} even though that string already contains it,
   * because the two are different questions. `grammar` describes *this
   * occurrence* — `3rd sg · present` — and is prose meant to be read; this is a
   * fact about the lexeme, meant to be looked up. A screen that wants to mark
   * `mano` as feminine cannot do it by parsing a sentence out of `grammar`.
   */
  readonly gender?: Gender;
  /** Meaning in the reference language, if known. */
  readonly gloss?: string;
  /** Grammar of this occurrence, e.g. `1st sg · present · indicative`. */
  readonly grammar?: string;
  /** How the word itself is marked: colloquial, or regional like `papa`. */
  readonly register?: Register;
  readonly regions?: readonly LanguageTag[];
  readonly constructions: readonly WordConstruction[];
  /** The rest of the paradigm: a verb's other conjugations, a noun's plural. */
  readonly forms: readonly WordForm[];
  /** Other phrases in the dataset that use this word. */
  readonly examples: readonly WordExample[];
}

export interface InspectOptions {
  readonly maxExamples?: number;
  readonly maxForms?: number;
  /**
   * The item ids in the learner's course, so its own sentences illustrate a word
   * first.
   *
   * A set of ids rather than an {@link ItemFilter}, because the caller usually
   * has one already — a screen scoped to a course has run that query to count
   * something — and re-running it per inspected word would scan the whole pack
   * once per result. Absent means no preference, which is what every existing
   * caller gets.
   */
  readonly scope?: ReadonlySet<ItemId>;
  /**
   * Items already shown, and so not worth offering again as examples.
   *
   * The phrase being inspected is always excluded — "other phrases that use this
   * word" would be a strange list to open with the sentence in front of you — and
   * this is the same rule for a caller that is showing more than one thing. A
   * search for `Tengo que trabajar.` puts that sentence at the top as the answer,
   * and listing it again under `tener` reads as a second result rather than as the
   * same one.
   */
  readonly exclude?: ReadonlySet<ItemId>;
  /**
   * A written form whose sentences should illustrate the word first.
   *
   * Set by {@link inspectLexeme} from what the learner typed. A bias like
   * {@link scope} and ranked below it: the course is the standing context, so a
   * form match never promotes something out of a learner's level.
   */
  readonly prefer?: string;
  /**
   * Whether to include reference-language meanings. Defaults to true.
   *
   * A card that grades what a phrase *means* cannot hand that over while the
   * question is live — but which word this is, what form it is in and what else
   * that verb does are not the answer to anything, and they are most of the
   * reason to tap a word during practice. So meaning is separable here rather
   * than at the call site: the gloss, the pattern's explanation, the example
   * translations and the surrounding sentence's translation are all the same
   * kind of thing, and four places deciding that independently is four places
   * for one of them to leak.
   */
  readonly meanings?: boolean;
}

/** Punctuation carries nothing worth showing, so it is never inspectable. */
export function isInspectable(token: Token): boolean {
  return token.pos !== 'PUNCT' && normalise(token.text).length > 0;
}

/**
 * The reserved id a word card is inspected under.
 *
 * A vocabulary item has no tokens — the card *is* the word — so there is
 * nothing to find by id. Naming that case keeps one selection state, one
 * `onSelect` signature and one sheet across both kinds of card, and a `#`
 * cannot collide with the `t1`-style ids the dataset build issues.
 */
export const WHOLE_ITEM_TOKEN: TokenId = '#item';

/**
 * True for an item that is itself one inspectable word.
 *
 * Asked of the item alone, because the text has to decide whether a word is
 * tappable before anything has been looked up. A word card carries its lexeme
 * and no tokens; the dataset issues one lexeme per card, which is what the `-`
 * id convention for a shared surface form (the noun `frío` beside the adjective)
 * exists to protect.
 */
export function isInspectableItem(item: LearningItem): boolean {
  return (
    item.type === 'word' && (item.tokens ?? []).length === 0 && (item.lexemes?.length ?? 0) > 0
  );
}

/**
 * Everything known about one token of a phrase — or, under
 * {@link WHOLE_ITEM_TOKEN}, about a card that is a single word.
 */
export function inspectToken(
  repository: ContentRepository,
  item: LearningItem,
  tokenId: TokenId,
  language: LanguageTag,
  options: InspectOptions = {},
): WordInfo | null {
  if (tokenId === WHOLE_ITEM_TOKEN) return inspectItem(repository, item, language, options);

  const token = (item.tokens ?? []).find((candidate) => candidate.id === tokenId);
  if (!token || !isInspectable(token)) return null;
  return describeWord(repository, item, token, language, options);
}

/**
 * A word card as its own entry: meaning, part of speech, gender and the
 * sentences that use it.
 *
 * Nothing new is derived. The item's lexeme becomes a token and the same
 * assembly runs over it, so a word card and a word inside a phrase are
 * explained by one code path rather than two that drift. Gender travels as
 * morphology because that is what a noun's `feminine` is, and the sheet already
 * reads grammar from there; the meaning arrives through the existing lexeme →
 * word-item gloss fallback, which is exactly this item's own translation.
 */
export function inspectItem(
  repository: ContentRepository,
  item: LearningItem,
  language: LanguageTag,
  options: InspectOptions = {},
): WordInfo | null {
  if (!isInspectableItem(item)) return null;

  const lexemeId = item.lexemes?.[0];
  if (lexemeId === undefined) return null;
  const lexeme = repository.getLexeme(lexemeId);

  const token: Token = {
    id: WHOLE_ITEM_TOKEN,
    text: item.text,
    lexeme: lexemeId,
    ...(lexeme ? { lemma: lexeme.lemma, pos: lexeme.pos } : {}),
    ...(lexeme?.gender ? { morph: { gender: lexeme.gender } } : {}),
  };

  return describeWord(repository, item, token, language, options);
}

/**
 * Everything known about one headword, reached by identity rather than through a
 * phrase containing it.
 *
 * The entry point a search needs and `inspectToken` cannot be: that one starts
 * from an item and a token id, and a learner who typed `tengo` has neither.
 * `surface` is what they wrote, so the paradigm can still mark which form they
 * met — the only thing the host phrase was carrying that a lexeme does not.
 *
 * Deliberately the same {@link WordInfo} the sheet already renders, rather than
 * a shape of its own. A word's meaning, kind, gender, register and paradigm are
 * the same facts whether it was tapped in a sentence or typed into a box, and
 * two shapes for them would be two places to add the next field to.
 */
export function inspectLexeme(
  repository: ContentRepository,
  lexemeId: LexemeId,
  language: LanguageTag,
  options: InspectOptions & { readonly surface?: string } = {},
): WordInfo | null {
  const lexeme = repository.getLexeme(lexemeId);
  if (!lexeme) return null;

  const token: Token = {
    id: WHOLE_ITEM_TOKEN,
    text: options.surface ?? lexeme.lemma,
    lexeme: lexemeId,
    lemma: lexeme.lemma,
    pos: lexeme.pos,
    ...(lexeme.gender ? { morph: { gender: lexeme.gender } } : {}),
  };

  // No item, so no constructions and nothing to exclude from the examples: an
  // annotation is a fact about one phrase, and there is no phrase here. The
  // patterns this word takes part in are still reachable — through the skills
  // its examples carry, which is a different question and a different list.
  //
  // `prefer` is passed only from here, and that is deliberate: this is the one
  // entry point that knows what a learner *wrote*. A lookup for `tengo` that
  // opened with `El alfabeto español tiene veintisiete letras.` answered the
  // right word with the wrong form, in a sentence about something else. The
  // sheet's own callers pass no surface and keep pack order exactly as before.
  return describeWord(repository, undefined, token, language, {
    ...options,
    ...(options.surface ? { prefer: options.surface } : {}),
  });
}

function describeWord(
  repository: ContentRepository,
  item: LearningItem | undefined,
  token: Token,
  language: LanguageTag,
  options: InspectOptions,
): WordInfo {
  const tokenId = token.id;
  const lexemeId = token.lexeme;
  const lexeme = lexemeId ? repository.getLexeme(lexemeId) : undefined;
  const pos = token.pos ?? lexeme?.pos;
  const lemma = token.lemma ?? lexeme?.lemma;
  const meanings = options.meanings !== false;

  return {
    token,
    constructions: item ? constructionsOf(repository, item, tokenId, language, meanings) : [],
    forms: lexemeId ? paradigmOf(repository, lexemeId, token, options.maxForms ?? 8) : [],
    examples: lexemeId
      ? examplesOf(repository, lexemeId, language, options.maxExamples ?? 3, meanings, {
          exclude: excluded(item?.id, options.exclude),
          ...(options.scope ? { scope: options.scope } : {}),
          ...(options.prefer ? { prefer: options.prefer } : {}),
        })
      : [],
    ...(lexemeId ? { lexeme: lexemeId } : {}),
    ...optional('register', lexeme?.register),
    ...(lexeme?.regions?.length ? { regions: lexeme.regions } : {}),
    ...(lemma ? { lemma } : {}),
    ...(pos ? { pos, posLabel: POS_LABELS[pos] } : {}),
    // The occurrence first, then the lexeme: an inflected form can be feminine
    // where its lemma is not (`la profesora` from `profesor`), and the form in
    // front of the learner is the one being explained.
    ...optional('gender', token.morph?.gender ?? lexeme?.gender),
    ...(lexemeId && meanings ? optional('gloss', glossOf(repository, lexemeId, language)) : {}),
    ...optional('grammar', describeMorphology(token.morph)),
  };
}

/** `1st sg · present · indicative` — empty when nothing is annotated. */
export function describeMorphology(morph: Morphology | undefined): string | undefined {
  if (!morph) return undefined;

  // A command is best described by who it is aimed at, because that is the choice
  // the learner is making. `command · usted` beats `2nd sg · imperative · formal`,
  // and it matches the vocabulary the rest of the app uses for address.
  if (morph.mood === 'imperative') {
    const audience = COMMAND_AUDIENCE[`${morph.number ?? 'singular'}:${morph.formality ?? ''}`];
    return audience ? `command · ${audience}` : 'command';
  }

  const parts: string[] = [];

  if (morph.verbForm === 'infinitive') parts.push('infinitive');
  else if (morph.verbForm === 'gerund') parts.push('gerund');
  else if (morph.verbForm === 'participle') parts.push('participle');

  const person = personLabel(morph);
  if (person) parts.push(person);
  if (morph.tense) parts.push(TENSE_LABELS[morph.tense] ?? morph.tense);
  if (morph.mood && morph.mood !== 'indicative') parts.push(morph.mood);
  if (morph.gender) parts.push(morph.gender);
  if (morph.formality) parts.push(morph.formality);

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

const COMMAND_AUDIENCE: Record<string, string | undefined> = {
  'singular:informal': 'tú',
  'singular:formal': 'usted',
  'plural:informal': 'vosotros',
  'plural:formal': 'ustedes',
};

function personLabel(morph: Morphology): string | undefined {
  if (morph.person === undefined) return morph.number ? NUMBER_LABELS[morph.number] : undefined;
  const ordinal = PERSON_LABELS[morph.person];
  const count = morph.number ? ` ${NUMBER_LABELS[morph.number]}` : '';
  return `${ordinal}${count}`;
}

function glossOf(
  repository: ContentRepository,
  lexemeId: LexemeId,
  language: LanguageTag,
): string | undefined {
  const direct = repository.translationOf(lexemeId, language);
  if (direct) return direct.text;

  // Fall back to a single-word item for the same lexeme: `cerveza` as an item
  // already carries the meaning even when the lexeme itself has no gloss.
  for (const candidate of repository.itemsOfLexeme(lexemeId)) {
    if (candidate.type !== 'word') continue;
    const translation = repository.translationOf(candidate.id, language);
    if (translation) return translation.text;
  }
  return undefined;
}

function constructionsOf(
  repository: ContentRepository,
  item: LearningItem,
  tokenId: TokenId,
  language: LanguageTag,
  meanings: boolean,
): readonly WordConstruction[] {
  const constructions: WordConstruction[] = [];
  for (const annotation of item.annotations ?? []) {
    if (!annotation.tokens.includes(tokenId)) continue;
    const skill = annotation.skill ? repository.getSkill(annotation.skill) : undefined;
    const label = annotation.label ?? skill?.label;
    if (!label) continue;
    const gloss =
      annotation.skill && meanings
        ? repository.translationOf(annotation.skill, language)?.text
        : undefined;
    constructions.push({
      label,
      ...(annotation.skill ? { skill: annotation.skill } : {}),
      ...optional('gloss', gloss),
    });
  }
  return constructions;
}

/**
 * The paradigm around the form in front of the learner.
 *
 * Named for what it produces rather than for what it reads, because
 * `repository.formsOf` is the read and this is the presentation of it: labels
 * resolved, the current form marked, the list capped.
 */
function paradigmOf(
  repository: ContentRepository,
  lexemeId: LexemeId,
  token: Token,
  limit: number,
): readonly WordForm[] {
  const current = normalise(token.text);
  return repository
    .formsOf(lexemeId)
    .slice(0, limit)
    .map((form) => ({
      form: form.form,
      label: describeMorphology(form.morph) ?? '',
      current: normalise(form.form) === current,
    }));
}

/**
 * Other phrases using this word, the learner's own course first.
 *
 * The scope is a **bias, never a filter** — the rule a focus and the speaker's
 * gender already follow, and here for a concrete reason. A learner on A1 who
 * searches a B1 word has no in-course examples at all, so filtering would answer
 * a real question with an empty list. Ordering answers it with B1 sentences,
 * which is the honest reply: this is the word, and here is where it is used.
 *
 * There is deliberately no ranking beyond that. Pack order is arbitrary but
 * stable, and a frequency- or length-based sort is a judgement worth making
 * against real content rather than guessed at now.
 */
function examplesOf(
  repository: ContentRepository,
  lexemeId: LexemeId,
  language: LanguageTag,
  limit: number,
  meanings: boolean,
  options: {
    readonly scope?: ReadonlySet<ItemId>;
    readonly exclude?: ReadonlySet<ItemId>;
    readonly prefer?: string;
  } = {},
): readonly WordExample[] {
  const exclude = options.exclude;
  const candidates = repository
    .itemsOfLexeme(lexemeId)
    .filter((candidate) => !exclude?.has(candidate.id) && candidate.type !== 'word');
  const scope = options.scope;
  const prefer = options.prefer ? normalise(options.prefer) : undefined;

  // Two keys, and the order between them is the decision: the course first,
  // because a level is the standing context and a learner on A1 should not be
  // shown B1 to make a form match; the form second, so within the course the
  // sentences using the word as it was written come first. `sort` is stable, so
  // pack order survives underneath both.
  const ordered = candidates.slice().sort((a, b) => {
    const inScope = scope ? Number(!scope.has(a.id)) - Number(!scope.has(b.id)) : 0;
    if (inScope !== 0) return inScope;
    if (!prefer) return 0;
    const has = (item: LearningItem) => Number(!normalise(item.text).includes(prefer));
    return has(a) - has(b);
  });

  return ordered.slice(0, limit).map((candidate) => ({
    id: candidate.id,
    text: candidate.text,
    ...(meanings
      ? optional('translation', repository.translationOf(candidate.id, language)?.text)
      : {}),
  }));
}

/**
 * The host phrase plus whatever the caller has already shown.
 *
 * One set rather than two arguments, so `examplesOf` has a single question to
 * ask. An empty set is returned rather than `undefined` because both callers
 * always have at least the possibility of one.
 */
function excluded(
  host: ItemId | undefined,
  extra: ReadonlySet<ItemId> | undefined,
): ReadonlySet<ItemId> {
  if (!host) return extra ?? new Set();
  const all = new Set(extra ?? []);
  all.add(host);
  return all;
}

/** Omits the key entirely when the value is absent (exactOptionalPropertyTypes). */
function optional<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

const PERSON_LABELS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };
const NUMBER_LABELS: Record<string, string> = { singular: 'sg', plural: 'pl' };

const TENSE_LABELS: Record<string, string> = {
  present: 'present',
  preterite: 'preterite',
  imperfect: 'imperfect',
  future: 'future',
  'present-perfect': 'present perfect',
  'past-perfect': 'past perfect',
  conditional: 'conditional',
};

export const POS_LABELS: Record<PartOfSpeech, string> = {
  NOUN: 'noun',
  VERB: 'verb',
  ADJ: 'adjective',
  ADV: 'adverb',
  PRON: 'pronoun',
  DET: 'determiner',
  ADP: 'preposition',
  AUX: 'auxiliary',
  CCONJ: 'conjunction',
  SCONJ: 'conjunction',
  NUM: 'numeral',
  PART: 'particle',
  INTJ: 'interjection',
  PROPN: 'proper noun',
  PUNCT: 'punctuation',
  X: 'other',
};

/* ------------------------------------------------------------------------- *
 * Phrases
 *
 * A word is not the only thing a learner points at. `tener que`, `hay que`, `a
 * la derecha` mean something as a unit that their parts do not, and the dataset
 * already knows it: an `Annotation` spans several tokens and can carry the skill
 * the pattern belongs to. Until now nothing could ask about a span, so that data
 * was only reachable one word at a time.
 * ------------------------------------------------------------------------- */

/** One word of a selected phrase, summarised rather than fully inspected. */
export interface PhraseWord {
  readonly token: Token;
  readonly lemma?: string;
  readonly posLabel?: string;
  readonly gloss?: string;
  readonly grammar?: string;
}

export interface PhraseInfo {
  readonly tokens: readonly Token[];
  /** The selected words as they read, spacing and punctuation included. */
  readonly text: string;
  /** Patterns the selection takes part in, the ones covering all of it first. */
  readonly constructions: readonly WordConstruction[];
  /**
   * Word by word. A phrase has to explain its parts as well as itself, because
   * "you have to" does not tell anyone which of those three words is `que`.
   */
  readonly words: readonly PhraseWord[];
  /** What the whole phrase this sits in means, as context. */
  readonly context?: string;
  /** Other phrases built on the same pattern. */
  readonly examples: readonly WordExample[];
}

/** Words of an item in order, skipping punctuation — what a span may contain. */
function inspectableTokens(item: LearningItem): readonly Token[] {
  return (item.tokens ?? []).filter(isInspectable);
}

/**
 * The selection with one more word on the given side, or unchanged at the edge.
 *
 * Punctuation is stepped over rather than selected: a span running to the end of
 * a sentence should read `Tengo que trabajar`, not `Tengo que trabajar .`.
 */
export function expandSpan(
  item: LearningItem,
  selected: readonly TokenId[],
  direction: 'before' | 'after',
): readonly TokenId[] {
  const words = inspectableTokens(item);
  const positions = selected
    .map((tokenId) => words.findIndex((token) => token.id === tokenId))
    .filter((index) => index >= 0);
  if (positions.length === 0) return selected;

  const next = direction === 'before' ? Math.min(...positions) - 1 : Math.max(...positions) + 1;
  const token = words[next];
  if (!token) return selected;

  const ordered = new Set([...selected, token.id]);
  return words.filter((entry) => ordered.has(entry.id)).map((entry) => entry.id);
}

/** The word that would be added on that side, for naming the control. */
export function nextInSpan(
  item: LearningItem,
  selected: readonly TokenId[],
  direction: 'before' | 'after',
): Token | undefined {
  const expanded = expandSpan(item, selected, direction);
  if (expanded.length === selected.length) return undefined;
  const added = expanded.find((tokenId) => !selected.includes(tokenId));
  return inspectableTokens(item).find((token) => token.id === added);
}

/**
 * Everything known about a run of words: the pattern they form, what each of
 * them is, and the sentence they sit in.
 *
 * A one-token span is deliberately *not* handled here — inspectToken says more
 * about a single word (its other forms, other phrases using it) and the sheet
 * asks for whichever fits the selection.
 */
export function inspectSpan(
  repository: ContentRepository,
  item: LearningItem,
  selected: readonly TokenId[],
  language: LanguageTag,
  options: InspectOptions = {},
): PhraseInfo | null {
  const chosen = new Set(selected);
  const all = item.tokens ?? [];
  const positions = all.flatMap((token, index) => (chosen.has(token.id) ? [index] : []));
  if (positions.length === 0) return null;

  /*
   * The run as it is written, not only the words that were tapped.
   *
   * A span is grown one *word* at a time, so the tokens between its ends are
   * punctuation — and dropping them made a selection across a comma read
   * `Hola cómo` where the sentence says `Hola, ¿cómo`. The breakdown below still
   * lists only words, because a comma has nothing to explain.
   */
  const tokens = all
    .slice(Math.min(...positions), Math.max(...positions) + 1)
    .filter((token) => chosen.has(token.id) || !isInspectable(token));

  const words = tokens.filter(isInspectable);
  const meanings = options.meanings !== false;
  const constructions = spanConstructions(repository, item, chosen, language, meanings);
  const skill = constructions.find((construction) => construction.skill)?.skill;

  return {
    tokens,
    text: joinTokens(tokens),
    constructions,
    words: words.map((token) => describePhraseWord(repository, token, language, meanings)),
    examples: skill
      ? examplesOfSkill(repository, skill, item.id, language, options.maxExamples ?? 3, meanings, {
          ...(options.scope ? { scope: options.scope } : {}),
        })
      : [],
    ...(meanings ? optional('context', repository.translationOf(item.id, language)?.text) : {}),
  };
}

/**
 * Patterns touching the selection, the ones that cover all of it first.
 *
 * Overlap rather than an exact match, because a learner selecting `que
 * trabajar` out of `Tengo que trabajar` is asking about the same construction as
 * one who selected the whole thing — and refusing to answer unless the selection
 * matched the annotation's boundaries exactly would make the feature a guessing
 * game about where those boundaries are.
 */
function spanConstructions(
  repository: ContentRepository,
  item: LearningItem,
  selected: ReadonlySet<TokenId>,
  language: LanguageTag,
  meanings: boolean,
): readonly WordConstruction[] {
  const scored: { construction: WordConstruction; covers: boolean }[] = [];

  for (const annotation of item.annotations ?? []) {
    const shared = annotation.tokens.filter((token) => selected.has(token));
    if (shared.length === 0) continue;

    const skill = annotation.skill ? repository.getSkill(annotation.skill) : undefined;
    const label = annotation.label ?? skill?.label;
    if (!label) continue;

    const gloss =
      annotation.skill && meanings
        ? repository.translationOf(annotation.skill, language)?.text
        : undefined;

    scored.push({
      construction: {
        label,
        ...(annotation.skill ? { skill: annotation.skill } : {}),
        ...optional('gloss', gloss),
      },
      covers: shared.length === selected.size,
    });
  }

  return scored
    .sort((a, b) => Number(b.covers) - Number(a.covers))
    .map((entry) => entry.construction);
}

function describePhraseWord(
  repository: ContentRepository,
  token: Token,
  language: LanguageTag,
  meanings: boolean,
): PhraseWord {
  const lexeme = token.lexeme ? repository.getLexeme(token.lexeme) : undefined;
  const pos = token.pos ?? lexeme?.pos;
  const lemma = token.lemma ?? lexeme?.lemma;

  return {
    token,
    ...(lemma ? { lemma } : {}),
    ...(pos ? { posLabel: POS_LABELS[pos] } : {}),
    ...(token.lexeme && meanings
      ? optional('gloss', glossOf(repository, token.lexeme, language))
      : {}),
    ...optional('grammar', describeMorphology(token.morph)),
  };
}

/** Other phrases built the same way, biased to the course exactly as {@link examplesOf} is. */
function examplesOfSkill(
  repository: ContentRepository,
  skill: SkillId,
  exclude: ItemId,
  language: LanguageTag,
  limit: number,
  meanings: boolean,
  options: { readonly scope?: ReadonlySet<ItemId> } = {},
): readonly WordExample[] {
  const candidates = repository.itemsOfSkill(skill).filter((candidate) => candidate.id !== exclude);
  const scope = options.scope;
  const ordered = scope
    ? [
        ...candidates.filter((candidate) => scope.has(candidate.id)),
        ...candidates.filter((candidate) => !scope.has(candidate.id)),
      ]
    : candidates;

  return ordered.slice(0, limit).map((candidate) => ({
    id: candidate.id,
    text: candidate.text,
    ...(meanings
      ? optional('translation', repository.translationOf(candidate.id, language)?.text)
      : {}),
  }));
}

const NO_SPACE_BEFORE = new Set(['.', ',', '!', '?', ';', ':', '»', ')']);
const NO_SPACE_AFTER = new Set(['¿', '¡', '«', '(']);

/**
 * Whether a space belongs between two tokens, so `¿Dónde está el baño?` reads
 * correctly. Order is data; spacing is derived (Rule 3).
 *
 * Here rather than in the component because the same decision has to be made
 * without a DOM — for a share payload, an AI prompt or an accessible name — and
 * two spellings of it would eventually disagree.
 */
export function needsSpaceBefore(previous: string | undefined, current: string): boolean {
  if (previous === undefined) return false;
  if (NO_SPACE_BEFORE.has(current)) return false;
  return !NO_SPACE_AFTER.has(previous);
}

/** Tokens as running text. */
export function joinTokens(tokens: readonly Token[]): string {
  return tokens.reduce((text, token, index) => {
    const spaced = needsSpaceBefore(tokens[index - 1]?.text, token.text);
    return `${text}${spaced ? ' ' : ''}${token.text}`;
  }, '');
}
