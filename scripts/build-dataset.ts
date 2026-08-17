#!/usr/bin/env tsx
/**
 * Builds the `core-es` pack from the authoring sources in `content/es/`.
 *
 * Authors write compact TSV; this script derives everything mechanical:
 * verb forms (via the conjugator), noun plurals and adjective forms, stable
 * ids, sentence tokenisation, lexeme links, grammar-pattern annotations and
 * the translation records.
 *
 * Deriving rather than hand-writing is the point: a human should never type
 * `hablábamos`, and a dataset should never disagree with itself about whether
 * `tengo` belongs to `tener`.
 *
 * Usage: tsx scripts/build-dataset.ts
 */

import { readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { conjugate } from '../src/languages/es/conjugation.ts';
import { IRREGULAR_VERBS } from '../src/languages/es/irregulars.ts';
import { adjectiveForms, pluralOf } from '../src/languages/es/morphology.ts';

const CONTENT_DIR = resolve('content/es');
const OUT_DIR = resolve('public/packs/core-es');
const PACK_ID = 'core-es';
const NS = `${PACK_ID}:`;

// ── source rows ─────────────────────────────────────────────────────────────

interface VerbRow {
  lemma: string;
  gloss: string;
  level: string;
  regularity: string;
  topics: string[];
}
interface NounRow {
  lemma: string;
  gloss: string;
  gender: string;
  plural: string;
  level: string;
  topics: string[];
  /** Regions where this is the usual word: papa in Latin America, patata in Spain. */
  regions: string[];
  register: string;
}
interface ModifierRow {
  lemma: string;
  gloss: string;
  pos: string;
  level: string;
  topics: string[];
  /** Extra surface forms that should link to this lexeme (la, los, buen…). */
  forms: string[];
}
interface SentenceRow {
  text: string;
  translation: string;
  level: string;
  topics: string[];
  note: string;
  /** neutral | colloquial | formal | vulgar; blank means neutral. */
  register: string;
  /** tu | usted | vosotros | ustedes; blank means derive it or leave unset. */
  address: string;
  /** Regions where this is said, blank meaning everywhere. */
  regions: string[];
  source: string;
}

function readTsv(file: string): string[][] {
  return readFileSync(join(CONTENT_DIR, file), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0 && !line.startsWith('#'))
    .map((line) => line.split('\t').map((cell) => cell.trim()));
}

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const verbs: VerbRow[] = readTsv('verbs.tsv').map(([lemma, gloss, level, regularity, topics]) => ({
  lemma: lemma!,
  gloss: gloss!,
  level: level!,
  regularity: regularity!,
  topics: list(topics),
}));

const nouns: NounRow[] = readTsv('nouns.tsv').map(
  ([lemma, gloss, gender, plural, level, topics, regions, register]) => ({
    lemma: lemma!,
    gloss: gloss!,
    gender: gender!,
    plural: plural ?? '',
    level: level!,
    topics: list(topics),
    regions: list(regions),
    register: register ?? '',
  }),
);

const modifiers: ModifierRow[] = readTsv('modifiers.tsv').map(
  ([lemma, gloss, pos, level, topics, forms]) => ({
    lemma: lemma!,
    gloss: gloss!,
    pos: pos!,
    level: level!,
    topics: list(topics),
    forms: list(forms),
  }),
);

const sentences: SentenceRow[] = readdirSync(CONTENT_DIR)
  .filter((file) => file.startsWith('sentences') && file.endsWith('.tsv'))
  .sort()
  .flatMap((file) =>
    readTsv(file).map(([text, translation, level, topics, note, register, address, regions]) => ({
      text: text!,
      translation: translation!,
      level: level!,
      topics: list(topics),
      note: note ?? '',
      register: register ?? '',
      address: address ?? '',
      regions: list(regions),
      source: file,
    })),
  );

// ── guards ──────────────────────────────────────────────────────────────────

const problems: string[] = [];

for (const verb of verbs) {
  const declared = verb.regularity === 'irregular';
  const known = Object.hasOwn(IRREGULAR_VERBS, verb.lemma);
  if (declared && !known) {
    problems.push(`${verb.lemma}: declared irregular but missing from irregulars.ts`);
  }
  if (!declared && known) {
    problems.push(`${verb.lemma}: declared regular but listed in irregulars.ts`);
  }
}

if (problems.length > 0) {
  console.error('Source problems:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// ── lexemes ─────────────────────────────────────────────────────────────────

interface LexemeRecord {
  id: string;
  lemma: string;
  pos: string;
  level: string;
  gender?: string;
  register?: string;
  regions?: string[];
  tags?: string[];
}

const lexemeIds = new Map<string, string>();
const takenIds = new Set<string>();

function lexemeId(lemma: string, pos: string): string {
  const key = `${lemma}|${pos}`;
  const existing = lexemeIds.get(key);
  if (existing) return existing;

  const base = `${NS}lexeme:${slug(lemma)}`;
  // Two lexemes may share a lemma (`mañana` the noun and the adverb); the part
  // of speech disambiguates the id rather than an arbitrary number.
  const id = takenIds.has(base) ? `${base}-${pos.toLowerCase()}` : base;
  takenIds.add(id);
  lexemeIds.set(key, id);
  return id;
}

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const verbLexemes: LexemeRecord[] = verbs.map((verb) => ({
  id: lexemeId(verb.lemma, 'VERB'),
  lemma: verb.lemma,
  pos: 'VERB',
  level: verb.level,
  tags: verb.regularity === 'irregular' ? ['irregular'] : [],
}));

const nounLexemes: LexemeRecord[] = nouns.map((noun) => ({
  id: lexemeId(noun.lemma, 'NOUN'),
  lemma: noun.lemma,
  pos: 'NOUN',
  level: noun.level,
  gender: noun.gender === 'f' ? 'feminine' : 'masculine',
  ...(noun.register ? { register: noun.register } : {}),
  ...(noun.regions.length > 0 ? { regions: noun.regions } : {}),
}));

const modifierLexemes: LexemeRecord[] = modifiers.map((modifier) => ({
  id: lexemeId(modifier.lemma, modifier.pos),
  lemma: modifier.lemma,
  pos: modifier.pos,
  level: modifier.level,
}));

// ── verb forms ──────────────────────────────────────────────────────────────

interface FormRecord {
  id: string;
  lexeme: string;
  form: string;
  morph: Record<string, unknown>;
  level: string;
  regions?: readonly string[];
}

const verbForms: FormRecord[] = verbs.flatMap((verb) => {
  const lexeme = lexemeId(verb.lemma, 'VERB');
  return conjugate(verb.lemma, IRREGULAR_VERBS[verb.lemma] ?? {}).map((generated) => ({
    id: `${NS}form:${slug(verb.lemma)}-${formSuffix(generated.morph)}`,
    lexeme,
    form: generated.form,
    morph: generated.morph as Record<string, unknown>,
    level: generated.level,
    ...(generated.regions ? { regions: generated.regions } : {}),
  }));
});

function formSuffix(morph: {
  tense?: string;
  person?: number;
  number?: string;
  verbForm?: string;
}) {
  if (morph.verbForm === 'gerund') return 'ger';
  if (morph.verbForm === 'participle') return 'part';
  const tense = { present: 'pres', preterite: 'pret', imperfect: 'imp' }[morph.tense ?? ''] ?? 'x';
  return `${tense}-${morph.person}${morph.number === 'plural' ? 'p' : 's'}`;
}

// ── surface form index, used to link sentence tokens to lexemes ─────────────

interface SurfaceEntry {
  lexeme: string;
  lemma: string;
  pos: string;
  morph?: Readonly<Record<string, unknown>>;
}

const surfaces = new Map<string, SurfaceEntry[]>();

function index(surface: string, entry: SurfaceEntry): void {
  const key = surface.toLowerCase();
  const existing = surfaces.get(key);
  if (existing) existing.push(entry);
  else surfaces.set(key, [entry]);
}

for (const verb of verbs) {
  const lexeme = lexemeId(verb.lemma, 'VERB');
  index(verb.lemma, { lexeme, lemma: verb.lemma, pos: 'VERB', morph: { verbForm: 'infinitive' } });
}
for (const form of verbForms) {
  const verb = verbLexemes.find((lexeme) => lexeme.id === form.lexeme);
  if (verb)
    index(form.form, { lexeme: form.lexeme, lemma: verb.lemma, pos: 'VERB', morph: form.morph });
}
for (const noun of nouns) {
  const lexeme = lexemeId(noun.lemma, 'NOUN');
  const gender = noun.gender === 'f' ? 'feminine' : 'masculine';
  index(noun.lemma, {
    lexeme,
    lemma: noun.lemma,
    pos: 'NOUN',
    morph: { gender, number: 'singular' },
  });
  const plural = noun.plural || pluralOf(noun.lemma);
  index(plural, { lexeme, lemma: noun.lemma, pos: 'NOUN', morph: { gender, number: 'plural' } });
}
for (const modifier of modifiers) {
  const lexeme = lexemeId(modifier.lemma, modifier.pos);
  const derived: { form: string; morph: Readonly<Record<string, unknown>> }[] =
    modifier.pos === 'ADJ'
      ? adjectiveForms(modifier.lemma).map((entry) => ({
          form: entry.form,
          morph: { ...entry.morph },
        }))
      : [{ form: modifier.lemma, morph: {} }];
  const declared = modifier.forms.map((form) => ({ form, morph: {} }));
  for (const { form, morph } of [...derived, ...declared]) {
    index(form, { lexeme, lemma: modifier.lemma, pos: modifier.pos, morph });
  }
}

// ── sentences → items ───────────────────────────────────────────────────────

interface Token {
  id: string;
  text: string;
  lemma?: string;
  pos?: string;
  morph?: Record<string, unknown>;
  lexeme?: string;
}

interface Annotation {
  tokens: string[];
  type: string;
  skill?: string;
  label?: string;
}

interface ItemRecord {
  id: string;
  pack: string;
  type: string;
  text: string;
  level: string;
  topics?: string[];
  tokens?: Token[];
  annotations?: Annotation[];
  lexemes?: string[];
  skills?: string[];
  examples?: string[];
  note?: string;
}

const TOKEN_PATTERN = /[¿¡]|[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+|[.,!?;:]/g;
const PUNCTUATION = new Set(['.', ',', '!', '?', ';', ':', '¿', '¡']);

/** Words after which a noun or adjective is far more likely than a verb. */
const NOMINAL_CUES = new Set([
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'al',
  'del',
  'mi',
  'mis',
  'tu',
  'tus',
  'su',
  'sus',
  'este',
  'esta',
  'estos',
  'estas',
  'ese',
  'esa',
  'nuestro',
  'nuestra',
  'mucho',
  'mucha',
  'muy',
  'poco',
  'otro',
  'otra',
  'cada',
]);

/**
 * Picks between lexemes that share a surface form. `trabajo` is the noun in
 * "el trabajo" and the verb in "trabajo en una oficina"; the word before it
 * decides. When the cue is missing or several candidates survive, the token is
 * left unlinked — a wrong lemma is worse than a missing one.
 */
function disambiguate(
  candidates: SurfaceEntry[],
  previous: Token | undefined,
): SurfaceEntry | null {
  if (candidates.length === 0) return null;

  // Several entries for one lexeme (lunes singular and plural are identical)
  // are not an ambiguity at all.
  if (new Set(candidates.map((entry) => entry.lexeme)).size === 1) return candidates[0]!;

  const previousText = previous?.text.toLowerCase() ?? '';
  const afterNominalCue = NOMINAL_CUES.has(previousText);
  // A noun is also the likely reading straight after a finite verb or a
  // preposition: "bebemos vino", "en casa".
  const afterVerbOrPreposition =
    previous?.morph?.['verbForm'] === 'finite' || previous?.pos === 'ADP';

  const preferred =
    afterNominalCue || afterVerbOrPreposition
      ? candidates.filter((entry) => entry.pos === 'NOUN' || entry.pos === 'ADJ')
      : candidates.filter((entry) => entry.pos === 'VERB');

  if (preferred.length === 1) return preferred[0]!;
  // A determiner introduces a noun phrase, so the noun wins over the adjective
  // that happens to share the form (la cara, mucho frío).
  const nouns = preferred.filter((entry) => entry.pos === 'NOUN');
  if (afterNominalCue && nouns.length === 1) return nouns[0]!;

  return null;
}

function tokenise(text: string): Token[] {
  const matches = text.match(TOKEN_PATTERN) ?? [];
  const tokens: Token[] = [];

  for (const [position, surface] of matches.entries()) {
    const id = `t${position + 1}`;
    if (PUNCTUATION.has(surface)) {
      tokens.push({ id, text: surface, pos: 'PUNCT' });
      continue;
    }

    const candidates = surfaces.get(surface.toLowerCase()) ?? [];
    const entry = disambiguate(candidates, tokens.at(-1));
    if (!entry) {
      tokens.push({ id, text: surface });
      continue;
    }
    tokens.push({
      id,
      text: surface,
      lemma: entry.lemma,
      pos: entry.pos,
      lexeme: entry.lexeme,
      ...(entry.morph && Object.keys(entry.morph).length > 0 ? { morph: entry.morph } : {}),
    });
  }

  return tokens;
}

const INFINITIVE = /(?:ar|er|ir|ír)$/;
const GERUND = /(?:ando|iendo|yendo)$/;
const PARTICIPLE = /(?:ado|ido|to|cho)$/;

interface PatternSpec {
  skill: string;
  label: string;
  gloss: string;
  level: string;
  match(tokens: Token[], position: number): string[] | null;
}

const isLemma = (token: Token | undefined, lemma: string) => token?.lemma === lemma;
const isWord = (token: Token | undefined, word: string) =>
  token?.text.toLowerCase() === word && token.pos !== 'PUNCT';
const looksInfinitive = (token: Token | undefined) =>
  token !== undefined && token.pos !== 'PUNCT' && INFINITIVE.test(token.text.toLowerCase());

const PATTERNS: PatternSpec[] = [
  {
    skill: `${NS}skill:tener-que-infinitive`,
    label: 'tener que + infinitivo',
    gloss: 'to have to do something',
    level: 'a1',
    match: (tokens, i) =>
      isLemma(tokens[i], 'tener') && isWord(tokens[i + 1], 'que') && looksInfinitive(tokens[i + 2])
        ? [tokens[i]!.id, tokens[i + 1]!.id, tokens[i + 2]!.id]
        : null,
  },
  {
    skill: `${NS}skill:ir-a-infinitive`,
    label: 'ir a + infinitivo',
    gloss: 'going to do something (near future)',
    level: 'a1',
    match: (tokens, i) =>
      isLemma(tokens[i], 'ir') && isWord(tokens[i + 1], 'a') && looksInfinitive(tokens[i + 2])
        ? [tokens[i]!.id, tokens[i + 1]!.id, tokens[i + 2]!.id]
        : null,
  },
  {
    skill: `${NS}skill:querer-infinitive`,
    label: 'querer + infinitivo',
    gloss: 'to want to do something',
    level: 'a1',
    match: (tokens, i) =>
      isLemma(tokens[i], 'querer') && looksInfinitive(tokens[i + 1])
        ? [tokens[i]!.id, tokens[i + 1]!.id]
        : null,
  },
  {
    skill: `${NS}skill:poder-infinitive`,
    label: 'poder + infinitivo',
    gloss: 'to be able to do something',
    level: 'a1',
    match: (tokens, i) =>
      isLemma(tokens[i], 'poder') && looksInfinitive(tokens[i + 1])
        ? [tokens[i]!.id, tokens[i + 1]!.id]
        : null,
  },
  {
    skill: `${NS}skill:estar-gerund`,
    label: 'estar + gerundio',
    gloss: 'what is happening right now',
    level: 'a1',
    match: (tokens, i) =>
      isLemma(tokens[i], 'estar') &&
      tokens[i + 1] !== undefined &&
      GERUND.test(tokens[i + 1]!.text.toLowerCase())
        ? [tokens[i]!.id, tokens[i + 1]!.id]
        : null,
  },
  {
    skill: `${NS}skill:present-perfect`,
    label: 'haber + participio',
    gloss: 'the present perfect: what has happened',
    level: 'a2',
    match: (tokens, i) =>
      isLemma(tokens[i], 'haber') &&
      tokens[i + 1] !== undefined &&
      tokens[i + 1]!.pos !== 'PUNCT' &&
      PARTICIPLE.test(tokens[i + 1]!.text.toLowerCase())
        ? [tokens[i]!.id, tokens[i + 1]!.id]
        : null,
  },
  {
    skill: `${NS}skill:gustar-type`,
    label: 'me gusta / me duele',
    gloss: 'verbs where the thing liked is the subject',
    level: 'a1',
    match: (tokens, i) => {
      const pronoun = tokens[i];
      const verb = tokens[i + 1];
      if (!pronoun || !verb) return null;
      if (!['me', 'te', 'le', 'nos', 'les'].includes(pronoun.text.toLowerCase())) return null;
      if (!['gustar', 'encantar', 'doler'].includes(verb.lemma ?? '')) return null;
      return [pronoun.id, verb.id];
    },
  },
  {
    skill: `${NS}skill:hay`,
    label: 'hay',
    gloss: 'there is / there are',
    level: 'a1',
    match: (tokens, i) => (isWord(tokens[i], 'hay') ? [tokens[i]!.id] : null),
  },
];

const TENSE_SKILLS: Record<string, { id: string; label: string; gloss: string; level: string }> = {
  present: {
    id: `${NS}skill:present-indicative`,
    label: 'presente de indicativo',
    gloss: 'the present tense',
    level: 'a1',
  },
  preterite: {
    id: `${NS}skill:preterite`,
    label: 'pretérito indefinido',
    gloss: 'the simple past: completed actions',
    level: 'a2',
  },
  imperfect: {
    id: `${NS}skill:imperfect`,
    label: 'pretérito imperfecto',
    gloss: 'how things used to be',
    level: 'a2',
  },
};

const usedSkills = new Set<string>();

/** Lexeme id → the regions that word belongs to, for propagating onto phrases. */
const nounRegions = new Map<string, string[]>(
  nouns
    .filter((noun) => noun.regions.length > 0)
    .map((noun) => [lexemeId(noun.lemma, 'NOUN'), noun.regions]),
);

/**
 * Who a sentence addresses, read from the verb morphology already in the data.
 *
 * Only the unambiguous cases are inferred: a second-person form is `tú` or
 * `vosotros` and nothing else. Third person is left alone because `está` is
 * `usted` or `él`/`ella` depending on context — those are declared by hand.
 */
function deriveAddress(tokens: readonly Token[]): string {
  for (const token of tokens) {
    const morph = token.morph as { person?: number; number?: string } | undefined;
    if (morph?.person !== 2) continue;
    return morph.number === 'plural' ? 'vosotros' : 'tu';
  }
  return '';
}

const sentenceItems: ItemRecord[] = sentences.map((sentence, position) => {
  const tokens = tokenise(sentence.text);
  const annotations: Annotation[] = [];

  for (let i = 0; i < tokens.length; i++) {
    for (const pattern of PATTERNS) {
      const matched = pattern.match(tokens, i);
      if (!matched) continue;
      annotations.push({
        tokens: matched,
        type: 'construction',
        skill: pattern.skill,
        label: pattern.label,
      });
      usedSkills.add(pattern.skill);
    }
  }

  const skills = new Set(annotations.map((annotation) => annotation.skill!).filter(Boolean));
  for (const token of tokens) {
    const tense = token.morph?.['tense'];
    if (typeof tense === 'string' && TENSE_SKILLS[tense]) {
      skills.add(TENSE_SKILLS[tense]!.id);
      usedSkills.add(TENSE_SKILLS[tense]!.id);
    }
  }

  const lexemes = [...new Set(tokens.map((token) => token.lexeme).filter(Boolean))] as string[];
  const hasFiniteVerb = tokens.some((token) => token.morph?.['verbForm'] === 'finite');
  const address = sentence.address || deriveAddress(tokens);
  // A sentence inherits the regional limits of the words it uses: a phrase
  // built on `papa` is not one a learner in Spain should be taught unmarked.
  const regions = [
    ...new Set([
      ...sentence.regions,
      ...lexemes.flatMap((id) => nounRegions.get(id) ?? []),
      ...(address === 'vosotros' ? ['es-ES'] : []),
    ]),
  ];

  return {
    id: `${NS}item:${String(position + 1).padStart(6, '0')}`,
    pack: PACK_ID,
    type: hasFiniteVerb ? 'sentence' : 'phrase',
    text: sentence.text,
    level: sentence.level,
    ...(sentence.register ? { register: sentence.register } : {}),
    ...(address ? { address } : {}),
    ...(regions.length > 0 ? { regions } : {}),
    ...(sentence.topics.length > 0 ? { topics: sentence.topics } : {}),
    tokens,
    ...(annotations.length > 0 ? { annotations } : {}),
    ...(lexemes.length > 0 ? { lexemes } : {}),
    ...(skills.size > 0 ? { skills: [...skills] } : {}),
  };
});

// ── vocabulary items (one card per noun and adjective) ──────────────────────

const examplesByLexeme = new Map<string, string[]>();
for (const item of sentenceItems) {
  for (const lexeme of item.lexemes ?? []) {
    const existing = examplesByLexeme.get(lexeme);
    if (existing) existing.push(item.id);
    else examplesByLexeme.set(lexeme, [item.id]);
  }
}

const vocabularySources = [
  ...nouns.map((noun) => ({
    lemma: noun.lemma,
    pos: 'NOUN',
    level: noun.level,
    topics: noun.topics,
    // A word card *is* the word, so it inherits whatever marks the lexeme:
    // `papa` must not be offered to someone learning the Spanish of Spain.
    regions: noun.regions,
    register: noun.register,
  })),
  ...modifiers
    .filter((modifier) => modifier.pos === 'ADJ')
    .map((modifier) => ({
      lemma: modifier.lemma,
      pos: 'ADJ',
      level: modifier.level,
      topics: modifier.topics,
      regions: [] as string[],
      register: '',
    })),
];

const vocabularyItems: ItemRecord[] = vocabularySources.map((entry, position) => {
  const lexeme = lexemeId(entry.lemma, entry.pos);
  const examples = (examplesByLexeme.get(lexeme) ?? []).slice(0, 3);
  return {
    id: `${NS}item:${String(500000 + position + 1).padStart(6, '0')}`,
    pack: PACK_ID,
    type: 'word',
    text: entry.lemma,
    level: entry.level,
    ...(entry.topics.length > 0 ? { topics: entry.topics } : {}),
    ...(entry.register ? { register: entry.register } : {}),
    ...(entry.regions.length > 0 ? { regions: entry.regions } : {}),
    lexemes: [lexeme],
    ...(examples.length > 0 ? { examples } : {}),
  };
});

// ── skills and translations ─────────────────────────────────────────────────

interface SkillRecord {
  id: string;
  kind: string;
  label: string;
  level: string;
}

const skillRecords: SkillRecord[] = [
  ...PATTERNS.map((pattern) => ({
    id: pattern.skill,
    kind: 'pattern',
    label: pattern.label,
    level: pattern.level,
  })),
  ...Object.values(TENSE_SKILLS).map((skill) => ({
    id: skill.id,
    kind: 'grammar',
    label: skill.label,
    level: skill.level,
  })),
].filter((skill) => usedSkills.has(skill.id));

const skillGlosses = new Map<string, string>([
  ...PATTERNS.map((pattern) => [pattern.skill, pattern.gloss] as const),
  ...Object.values(TENSE_SKILLS).map((skill) => [skill.id, skill.gloss] as const),
]);

interface TranslationRecord {
  ref: string;
  lang: string;
  text: string;
  type?: string;
  note?: string;
}

const translations: TranslationRecord[] = [
  ...sentences.map((sentence, position) => ({
    ref: sentenceItems[position]!.id,
    lang: 'en',
    text: sentence.translation,
    type: 'natural',
    ...(sentence.note ? { note: sentence.note } : {}),
  })),
  ...vocabularySources.map((entry, position) => ({
    ref: vocabularyItems[position]!.id,
    lang: 'en',
    text: glossOf(entry.lemma, entry.pos),
    type: 'natural',
  })),
  // Word-level meanings: what a learner sees when tapping a word in a phrase.
  ...verbs.map((verb) => ({ ref: lexemeId(verb.lemma, 'VERB'), lang: 'en', text: verb.gloss })),
  ...nouns.map((noun) => ({ ref: lexemeId(noun.lemma, 'NOUN'), lang: 'en', text: noun.gloss })),
  ...modifiers.map((modifier) => ({
    ref: lexemeId(modifier.lemma, modifier.pos),
    lang: 'en',
    text: modifier.gloss,
  })),
  ...skillRecords.map((skill) => ({
    ref: skill.id,
    lang: 'en',
    text: skillGlosses.get(skill.id) ?? skill.label,
  })),
];

function glossOf(lemma: string, pos: string): string {
  if (pos === 'NOUN') return nouns.find((noun) => noun.lemma === lemma)!.gloss;
  return modifiers.find((modifier) => modifier.lemma === lemma)!.gloss;
}

// ── write ───────────────────────────────────────────────────────────────────

const files = [
  { kind: 'skills', path: 'es-a1-a2-core-skills.jsonl', records: skillRecords },
  { kind: 'lexemes', path: 'es-a1-a2-core-verbs.jsonl', records: clean(verbLexemes) },
  { kind: 'lexemes', path: 'es-a1-a2-core-nouns.jsonl', records: clean(nounLexemes) },
  { kind: 'lexemes', path: 'es-a1-a2-core-modifiers.jsonl', records: clean(modifierLexemes) },
  { kind: 'verb-forms', path: 'es-a1-a2-core-verb-forms.jsonl', records: verbForms },
  { kind: 'items', path: 'es-a1-a2-core-vocabulary.jsonl', records: vocabularyItems },
  { kind: 'items', path: 'es-a1-a2-core-sentences.jsonl', records: sentenceItems },
  { kind: 'translations', path: 'es-a1-a2-core-translations-en.jsonl', records: translations },
] as const;

/** Drops empty arrays and undefined fields so the JSONL stays readable. */
function clean<T extends object>(records: readonly T[]): T[] {
  return records.map(
    (record) =>
      Object.fromEntries(
        Object.entries(record).filter(
          ([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0),
        ),
      ) as T,
  );
}

mkdirSync(OUT_DIR, { recursive: true });

for (const file of files) {
  const header = `# Generated by scripts/build-dataset.ts from content/es — do not edit by hand.\n`;
  const body = file.records.map((record) => JSON.stringify(record)).join('\n');
  writeFileSync(join(OUT_DIR, file.path), `${header}${body}\n`, 'utf8');
}

const manifest = {
  id: PACK_ID,
  name: 'Spanish Core A1–A2',
  targetLanguage: 'es',
  version: '0.1.0',
  description:
    'High-frequency Spanish verbs, nouns, modifiers and everyday sentences. Generated from content/es and not yet reviewed by a human editor.',
  license: 'CC0-1.0',
  levels: ['a1', 'a2'],
  referenceLanguages: ['en'],
  pronunciationLocales: ['es-ES', 'es-MX'],
  provenance: { source: 'generated', origin: 'content/es', review: 'unreviewed', revision: 1 },
  files: files.map((file) => ({ kind: file.kind, path: file.path })),
};

writeFileSync(join(OUT_DIR, 'pack.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

writeFileSync(
  resolve('public/packs/catalog.json'),
  `${JSON.stringify(
    {
      $comment: 'Packs shipped with this build. Generated by scripts/build-dataset.ts.',
      packs: [{ id: PACK_ID, manifest: 'core-es/pack.json' }],
    },
    null,
    2,
  )}\n`,
  'utf8',
);

// ── coverage report ─────────────────────────────────────────────────────────

const allLexemes = [...verbLexemes, ...nounLexemes, ...modifierLexemes];
const uncovered = allLexemes.filter((lexeme) => !examplesByLexeme.has(lexeme.id));
const byPos = (pos: string) => uncovered.filter((lexeme) => lexeme.pos === pos).length;

console.log(`\n${PACK_ID} built into ${OUT_DIR}`);
console.log(
  `  ${verbLexemes.length} verbs · ${nounLexemes.length} nouns · ${modifierLexemes.length} modifiers`,
);
console.log(`  ${verbForms.length} verb forms`);
console.log(`  ${sentenceItems.length} sentences · ${vocabularyItems.length} word cards`);
console.log(`  ${skillRecords.length} skills · ${translations.length} translations`);

const linked = sentenceItems.flatMap((item) => item.tokens ?? []);
const linkedCount = linked.filter((token) => token.lexeme).length;
const linkable = linked.filter((token) => token.pos !== 'PUNCT').length;
console.log(
  `\n  token linking: ${linkedCount}/${linkable} words linked to a lexeme ` +
    `(${Math.round((linkedCount / linkable) * 100)}%)`,
);
console.log(
  `  example coverage: ${allLexemes.length - uncovered.length}/${allLexemes.length} lexemes ` +
    `appear in at least one sentence`,
);
console.log(
  `  without an example: ${byPos('VERB')} verbs, ${byPos('NOUN')} nouns, ` +
    `${uncovered.length - byPos('VERB') - byPos('NOUN')} modifiers`,
);
