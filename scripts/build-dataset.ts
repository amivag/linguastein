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

import { readFileSync, mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PASSAGE_KINDS, SKILL_KINDS } from '../src/domain/content/model.ts';
import { sentenceMood } from '../src/domain/content/mood.ts';
import { conjugate } from '../src/languages/es/conjugation.ts';
import { IRREGULAR_VERBS } from '../src/languages/es/irregulars.ts';
import { adjectiveForms, pluralOf } from '../src/languages/es/morphology.ts';
import {
  NUMERAL_RULES,
  parseCardinal,
  parseOrdinal,
  spellCardinal,
  spellOrdinal,
  type NumeralRule,
} from '../src/languages/es/numerals.ts';

// Overridable so a test can build a scratch copy of the sources without
// touching the checked-in pack.
const CONTENT_DIR = resolve(process.env['LINGUASTEIN_CONTENT_DIR'] ?? 'content/es');
const PACKS_DIR = resolve(process.env['LINGUASTEIN_PACKS_DIR'] ?? 'public/packs');
const OUT_DIR = join(PACKS_DIR, 'core-es');
const PACK_ID = 'core-es';
const NS = `${PACK_ID}:`;

// ── source rows ─────────────────────────────────────────────────────────────

interface VerbRow {
  lemma: string;
  gloss: string;
  level: string;
  regularity: string;
  topics: string[];
  row: SourceRow;
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
  /** Where the row lives, so its word card can claim a stable id. */
  row: SourceRow;
}
interface ModifierRow {
  lemma: string;
  gloss: string;
  pos: string;
  level: string;
  topics: string[];
  /** Extra surface forms that should link to this lexeme (la, los, buen…). */
  forms: string[];
  row: SourceRow;
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
  /** Key of the passage this sentence reads as part of, blank if it stands alone. */
  passage: string;
  /** Who says this line, for dialogues only. */
  speaker: string;
  /** Authored skill slugs, resolved through skills.tsv. */
  skills: string[];
  source: string;
  row: SourceRow;
}
interface PassageRow {
  key: string;
  kind: string;
  title: string;
  titleTranslation: string;
  level: string;
  topics: string[];
  row: SourceRow;
}
interface AuthoredSkillRow {
  slug: string;
  kind: string;
  label: string;
  gloss: string;
  level: string;
  prerequisites: string[];
}

/**
 * A data row, with its stable id separated from the authored columns.
 *
 * Ids live in the first column and are optional: an author appends a row
 * without one and the build assigns it, so a row can be corrected, moved or
 * reordered without its id changing. Nothing else in a source file is six
 * digits, which is what makes the column safe to leave out.
 */
interface SourceRow {
  id: string | undefined;
  /**
   * `-` in the id column: this row contributes a lexeme and its meaning, but no
   * word card of its own. Some words are only learned in context — and a
   * homograph like the noun `frío` would otherwise ship a card identical to the
   * adjective's, which splits one word a learner sees into two ids.
   *
   * It never owns an id, so the ledger retires one it used to hold and the
   * sentences that use the word are untouched.
   */
  noCard: boolean;
  /** The authored columns, with any id stripped off the front. */
  fields: string[];
  /** Index into `SourceFile.lines`, so an assigned id can be written back. */
  line: number;
}

const NO_CARD = '-';

const TOPICS_FILE = 'topics.tsv';
const SKILLS_FILE = 'skills.tsv';
const PACK_FILE = 'pack.tsv';

/**
 * Below this many items a category is not worth opening, so the build names it.
 * Not a failure: a category is often registered before its content exists, and
 * failing here would make declaring one ahead of time impossible.
 */
const TOPIC_FLOOR = 8;

/** One thematic category: its stable slug, how to show it, and where it sits. */
interface TopicRow {
  slug: string;
  label: string;
  /** Display group heading, e.g. `Foundations`. Empty groups sort last. */
  group: string;
}

interface SourceFile {
  name: string;
  /** Every physical line, so comments and blank lines survive a write-back. */
  lines: string[];
  rows: SourceRow[];
}

const ID_PATTERN = /^\d{6}$/;

function readSource(file: string): SourceFile {
  const lines = readFileSync(join(CONTENT_DIR, file), 'utf8').split(/\r?\n/);
  const rows: SourceRow[] = [];

  for (const [line, text] of lines.entries()) {
    if (text.trim().length === 0 || text.startsWith('#')) continue;
    const cells = text.split('\t').map((cell) => cell.trim());
    const hasId = ID_PATTERN.test(cells[0] ?? '');
    const noCard = cells[0] === NO_CARD;
    rows.push({
      ...(hasId ? { id: cells[0]! } : { id: undefined }),
      noCard,
      // The sentinel occupies the id column, so it is stripped like an id.
      fields: hasId || noCard ? cells.slice(1) : cells,
      line,
    });
  }

  return { name: file, lines, rows };
}

const sourceFiles: SourceFile[] = [];

/** Reads a file, remembering it so assigned ids can be written back later. */
function readRows(file: string): SourceRow[] {
  const source = readSource(file);
  sourceFiles.push(source);
  return source.rows;
}

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const verbs: VerbRow[] = readRows('verbs.tsv').map((row) => {
  const [lemma, gloss, level, regularity, topics] = row.fields;
  return {
    lemma: lemma!,
    gloss: gloss!,
    level: level!,
    regularity: regularity!,
    topics: list(topics),
    row,
  };
});

const nouns: NounRow[] = readRows('nouns.tsv').map((row) => {
  const [lemma, gloss, gender, plural, level, topics, regions, register] = row.fields;
  return {
    lemma: lemma!,
    gloss: gloss!,
    gender: gender!,
    plural: plural ?? '',
    level: level!,
    topics: list(topics),
    regions: list(regions),
    register: register ?? '',
    row,
  };
});

const modifiers: ModifierRow[] = readRows('modifiers.tsv').map((row) => {
  const [lemma, gloss, pos, level, topics, forms] = row.fields;
  return {
    lemma: lemma!,
    gloss: gloss!,
    pos: pos!,
    level: level!,
    topics: list(topics),
    forms: list(forms),
    row,
  };
});

const sentences: SentenceRow[] = readdirSync(CONTENT_DIR)
  .filter((file) => file.startsWith('sentences') && file.endsWith('.tsv'))
  .sort()
  .flatMap((file) =>
    readRows(file).map((row) => {
      const [
        text,
        translation,
        level,
        topics,
        note,
        register,
        address,
        regions,
        passage,
        speaker,
        skills,
      ] = row.fields;
      return {
        text: text!,
        translation: translation!,
        level: level!,
        topics: list(topics),
        note: note ?? '',
        register: register ?? '',
        address: address ?? '',
        regions: list(regions),
        passage: passage ?? '',
        speaker: speaker ?? '',
        skills: list(skills),
        source: file,
        row,
      };
    }),
  );

const passageRows: PassageRow[] = existsSync(join(CONTENT_DIR, 'passages.tsv'))
  ? readRows('passages.tsv').map((row) => {
      const [key, kind, title, titleTranslation, level, topics] = row.fields;
      return {
        key: key!,
        kind: kind!,
        title: title!,
        titleTranslation: titleTranslation ?? '',
        level: level!,
        topics: list(topics),
        row,
      };
    })
  : [];

/**
 * The thematic-category registry. Read in authoring order, because that order
 * is what the category picker shows — sorting it here would silently discard a
 * decision the source file makes on purpose.
 *
 * Not read through `readRows`: the file carries no ids, so registering it for
 * id write-back would only give the allocator a file it must never touch.
 */
const topicRows: TopicRow[] = existsSync(join(CONTENT_DIR, TOPICS_FILE))
  ? readSource(TOPICS_FILE).rows.map((row) => {
      const [slug, label, group] = row.fields;
      return { slug: slug!, label: label ?? slug!, group: group ?? '' };
    })
  : [];

/** Authored skills are semantic curriculum data, so they own stable slugs, not item ids. */
const authoredSkillRows: AuthoredSkillRow[] = existsSync(join(CONTENT_DIR, SKILLS_FILE))
  ? readSource(SKILLS_FILE).rows.map((row) => {
      const [slug, kind, label, gloss, level, prerequisites] = row.fields;
      return {
        slug: slug!,
        kind: kind!,
        label: label!,
        gloss: gloss!,
        level: level!,
        prerequisites: list(prerequisites),
      };
    })
  : [];

/**
 * The pack's own version, and the item count it was cut at.
 *
 * Authored rather than derived, because a version is a judgement about what
 * changed and no amount of counting supplies one. It lived as a literal in this
 * script for its whole life and was written exactly once — the pack went from
 * 443 sentences to 1,395 still calling itself `0.1.0`, and Settings showed that
 * number to every learner. A version nobody can bump is worse than no version,
 * because it is displayed.
 *
 * `items` is the mechanism that stops it freezing again. The build reports a
 * disagreement and `tests/data/pack-version.test.ts` fails on one, so adding or
 * removing content forces an edit to this file — where the version is sitting on
 * the same line, which is the whole point. A wording fix changes no count and
 * needs no bump.
 */
interface PackRow {
  version: string;
  items: number;
}

const packRow: PackRow | undefined = existsSync(join(CONTENT_DIR, PACK_FILE))
  ? (() => {
      const [row] = readSource(PACK_FILE).rows;
      if (!row) return undefined;
      const [version, items] = row.fields;
      return { version: version!, items: Number(items ?? Number.NaN) };
    })()
  : undefined;

// ── guards ──────────────────────────────────────────────────────────────────

const problems: string[] = [];

if (!packRow) {
  problems.push(`${PACK_FILE}: missing — the pack has no version to ship`);
} else if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packRow.version)) {
  problems.push(`${PACK_FILE}: "${packRow.version}" is not a semver version`);
} else if (!Number.isInteger(packRow.items)) {
  problems.push(`${PACK_FILE}: "${packRow.items}" is not an item count`);
}

/**
 * Topics are a controlled vocabulary, not free text. Without this check
 * `colours` and `colors` both quietly exist, each holding half the content and
 * neither looking wrong in a diff — and a category picker built from whatever
 * the items happen to say would show both.
 */
if (topicRows.length > 0) {
  const registered = new Set(topicRows.map((topic) => topic.slug));
  const seen = new Map<string, string>();

  const check = (topics: string[], where: string): void => {
    for (const topic of topics) if (!registered.has(topic)) seen.set(topic, where);
  };

  for (const verb of verbs) check(verb.topics, `verbs.tsv (${verb.lemma})`);
  for (const noun of nouns) check(noun.topics, `nouns.tsv (${noun.lemma})`);
  for (const modifier of modifiers) check(modifier.topics, `modifiers.tsv (${modifier.lemma})`);
  for (const sentence of sentences) check(sentence.topics, `${sentence.source} (${sentence.text})`);
  for (const passage of passageRows) check(passage.topics, `passages.tsv (${passage.key})`);

  for (const [topic, where] of seen) {
    problems.push(
      `unknown topic "${topic}" in ${where} — add it to ${TOPICS_FILE} or fix the typo`,
    );
  }

  const duplicated = topicRows
    .map((topic) => topic.slug)
    .filter((slug, index, all) => all.indexOf(slug) !== index);
  for (const slug of new Set(duplicated)) {
    problems.push(`${TOPICS_FILE}: "${slug}" is registered more than once`);
  }
}

const authoredSkillSlugs = new Set(authoredSkillRows.map((skill) => skill.slug));
for (const skill of authoredSkillRows) {
  if (!(SKILL_KINDS as readonly string[]).includes(skill.kind)) {
    problems.push(`${SKILLS_FILE}: "${skill.slug}" has unknown kind "${skill.kind}"`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.slug)) {
    problems.push(`${SKILLS_FILE}: "${skill.slug}" is not a stable kebab-case slug`);
  }
  for (const prerequisite of skill.prerequisites) {
    if (!authoredSkillSlugs.has(prerequisite)) {
      problems.push(
        `${SKILLS_FILE}: "${skill.slug}" requires unknown authored skill "${prerequisite}"`,
      );
    }
  }
}

for (const duplicate of authoredSkillRows
  .map((skill) => skill.slug)
  .filter((slug, index, all) => all.indexOf(slug) !== index)) {
  problems.push(`${SKILLS_FILE}: "${duplicate}" is registered more than once`);
}

for (const sentence of sentences) {
  for (const skill of sentence.skills) {
    if (!authoredSkillSlugs.has(skill)) {
      problems.push(
        `unknown authored skill "${skill}" in ${sentence.source} (${sentence.text}) — add it to ${SKILLS_FILE} or fix the typo`,
      );
    }
  }
}

/**
 * A `NUM` lemma must be exactly what `numerals.ts` spells.
 *
 * The whole point of that module is that a human never types a Spanish numeral,
 * and a card row is still a place one could be typed — `dieciseis` without its
 * accent would look right in a diff and teach a misspelling. So the source and
 * the generator are cross-checked, the same way a verb's declared regularity is
 * cross-checked against `irregulars.ts`.
 *
 * A round trip, not set membership: reading the lemma back gives the number it
 * means, and spelling that number again has to return the very same string. So
 * `dieciseis` fails for having no reading, and a variant spelling fails even if
 * it parses, because it is not what the module would have written.
 */
const numeralValues = new Map<string, number>();

for (const modifier of modifiers) {
  if (modifier.pos !== 'NUM') continue;

  const value = parseCardinal(modifier.lemma);
  if (value === null) {
    problems.push(
      `${modifier.lemma}: tagged NUM but numerals.ts cannot read it — check the accent`,
    );
    continue;
  }
  const canonical = spellCardinal(value);
  if (canonical !== modifier.lemma) {
    problems.push(
      `${modifier.lemma}: numerals.ts spells ${value} as "${canonical}" — use that spelling`,
    );
    continue;
  }
  numeralValues.set(modifier.lemma, value);
}

/**
 * An ordinal is cross-checked the same way, and recognised rather than declared.
 *
 * There is no `ORD` tag to carry it: Spanish ordinals are adjectives and the
 * universal tag set says so, which is why `primero` and `tercero` were always
 * plain `ADJ` rows. So the *lemma* is the declaration — `parseOrdinal` accepts
 * exactly the twenty citation forms `numerals.ts` can spell and nothing else, so
 * no ordinary adjective can be mistaken for one, and a hand-typed `septimo`
 * fails the round trip instead of shipping.
 *
 * The payoff is that `primer` and `tercer` stop being authored. They used to sit
 * in the extra-surfaces column, which is a place a human types Spanish — the
 * thing this module exists to prevent. See {@link spellOrdinal}.
 */
const ordinalValues = new Map<string, number>();

for (const modifier of modifiers) {
  if (modifier.pos !== 'ADJ') continue;

  const value = parseOrdinal(modifier.lemma);
  if (value === null) continue;

  const canonical = spellOrdinal(value);
  if (canonical !== modifier.lemma) {
    problems.push(
      `${modifier.lemma}: numerals.ts spells the ${value}th as "${canonical}" — use that spelling`,
    );
    continue;
  }
  if (modifier.forms.length > 0) {
    problems.push(
      `${modifier.lemma}: an ordinal's forms are derived — drop the extra surfaces column (${modifier.forms.join(', ')})`,
    );
    continue;
  }
  ordinalValues.set(modifier.lemma, value);
}

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

// ── stable item ids ─────────────────────────────────────────────────────────

/**
 * Learner progress, attempt history and mastery all reference item ids, so an
 * id must mean the same item forever (spec §20). Ids used to be the row's
 * position, which meant inserting a sentence silently repointed every learner's
 * history at a different sentence.
 *
 * Now a row owns its id: the build assigns one to any row that lacks it and
 * writes it back into the source file. Correcting a typo, moving a row to
 * another file and reordering rows all keep the id, which is what §20.1
 * requires and what a content hash could not give.
 *
 * `id-ledger.tsv` remembers every id ever issued, so a deleted row's id is
 * retired rather than handed to the next new row.
 */
const LEDGER_FILE = 'id-ledger.tsv';

type IdKind = 'sentence' | 'noun-card' | 'modifier-card' | 'verb-card' | 'passage';

/** One range per kind, so appending a noun cannot renumber an adjective. */
const ID_RANGES: Record<IdKind, { first: number; last: number }> = {
  sentence: { first: 1, last: 499_999 },
  'noun-card': { first: 500_001, last: 599_999 },
  'modifier-card': { first: 600_001, last: 699_999 },
  passage: { first: 700_001, last: 799_999 },
  'verb-card': { first: 800_001, last: 899_999 },
};

interface LedgerEntry {
  readonly id: string;
  readonly kind: IdKind;
  readonly status: 'active' | 'retired';
  /** A reminder of what the id refers to. Never identity — the id is. */
  readonly text: string;
}

function readLedger(): Map<string, LedgerEntry> {
  const entries = new Map<string, LedgerEntry>();
  const path = join(CONTENT_DIR, LEDGER_FILE);
  if (!existsSync(path)) return entries;

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (line.trim().length === 0 || line.startsWith('#')) continue;
    const [id, kind, status, text] = line.split('\t').map((cell) => cell.trim());
    if (!id) continue;
    entries.set(id, {
      id,
      kind: kind as IdKind,
      status: status === 'retired' ? 'retired' : 'active',
      text: text ?? '',
    });
  }
  return entries;
}

const ledger = readLedger();

function allocatorFor(kind: IdKind): () => string {
  const range = ID_RANGES[kind];
  // Start above every id this range has ever issued, retired ones included.
  let cursor = range.first - 1;
  for (const entry of ledger.values()) {
    const value = Number(entry.id);
    if (value >= range.first && value <= range.last) cursor = Math.max(cursor, value);
  }
  return () => {
    cursor += 1;
    if (cursor > range.last) throw new Error(`${kind} ids exhausted at ${cursor}`);
    return String(cursor).padStart(6, '0');
  };
}

/** Every id claimed by this build, for the ledger and for duplicate detection. */
const claimed = new Map<string, { kind: IdKind; text: string }>();
const idProblems: string[] = [];

function claimId(row: SourceRow, kind: IdKind, text: string, next: () => string): string {
  const id = row.id ?? next();
  row.id = id;

  const existing = claimed.get(id);
  if (existing) {
    idProblems.push(`${id} is claimed by both "${existing.text}" and "${text}"`);
  }
  claimed.set(id, { kind, text });
  return id;
}

const nextSentenceId = allocatorFor('sentence');
for (const sentence of sentences) {
  claimId(sentence.row, 'sentence', sentence.text, nextSentenceId);
}

const nextNounCardId = allocatorFor('noun-card');
for (const noun of nouns) {
  if (noun.row.noCard) continue;
  claimId(noun.row, 'noun-card', noun.lemma, nextNounCardId);
}

// Only these parts of speech become word cards, so only those rows carry an id.
// A determiner or a preposition is learned in sentences, not off a card.
const CARD_POS = new Set(['ADJ', 'NUM']);

const nextModifierCardId = allocatorFor('modifier-card');
for (const modifier of modifiers) {
  // `-` in the id column, same as on a noun: keep the lexeme and its gloss, skip
  // the card. Until numerals arrived no modifier row had ever used the sentinel,
  // so this loop silently issued ids to rows that then had no card to own them.
  if (modifier.row.noCard || !CARD_POS.has(modifier.pos)) continue;
  claimId(modifier.row, 'modifier-card', modifier.lemma, nextModifierCardId);
}

/*
 * Every verb gets a card, including `haber`.
 *
 * The alternative was to give auxiliaries the `-` sentinel, and that was
 * rejected on purpose: the sentinel means two things today — a homograph that
 * would ship a duplicate card, and a word no sentence uses yet — and its being
 * narrow is what makes it readable. "Auxiliaries are not worth drilling" would
 * be a third meaning, decided by taste, in the one column a reader has to trust.
 * A card for `haber` is odd; a sentinel that means three unrelated things is
 * worse.
 */
const nextVerbCardId = allocatorFor('verb-card');
for (const verb of verbs) {
  if (verb.row.noCard) continue;
  claimId(verb.row, 'verb-card', verb.lemma, nextVerbCardId);
}

const nextPassageId = allocatorFor('passage');
for (const passage of passageRows) {
  claimId(passage.row, 'passage', passage.title, nextPassageId);
}

if (idProblems.length > 0) {
  console.error('Item id problems:\n  ' + idProblems.join('\n  '));
  process.exit(1);
}

const itemId = (row: SourceRow): string => `${NS}item:${row.id!}`;
const passageEntityId = (row: SourceRow): string => `${NS}passage:${row.id!}`;

/** Writes assigned ids back into the sources that gained them. */
function writeBackIds(): string[] {
  const touched: string[] = [];

  for (const source of sourceFiles) {
    let changed = false;
    for (const row of source.rows) {
      if (!row.id) continue;
      const cells = source.lines[row.line]!.split('\t').map((cell) => cell.trim());
      if (ID_PATTERN.test(cells[0] ?? '')) continue;
      source.lines[row.line] = [row.id, ...cells].join('\t');
      changed = true;
    }
    if (!changed) continue;
    writeFileSync(join(CONTENT_DIR, source.name), source.lines.join('\n'), 'utf8');
    touched.push(source.name);
  }

  return touched;
}

function writeLedger(): void {
  const entries: LedgerEntry[] = [
    ...[...claimed].map(([id, { kind, text }]) => ({
      id,
      kind,
      status: 'active' as const,
      text,
    })),
    // An id no row claims any more is retired, never reused.
    ...[...ledger.values()]
      .filter((entry) => !claimed.has(entry.id))
      .map((entry) => ({ ...entry, status: 'retired' as const })),
  ].sort((left, right) => left.id.localeCompare(right.id));

  const header = [
    `# Every item id ${PACK_ID} has ever issued. Generated by scripts/build-dataset.ts.`,
    '# A row that goes away keeps its id here as `retired`, so it is never reissued.',
    '# Columns: id\tkind\tstatus\ttext — text is a reminder, the id is the identity.',
  ].join('\n');
  const body = entries.map((entry) => [entry.id, entry.kind, entry.status, entry.text].join('\t'));

  writeFileSync(join(CONTENT_DIR, LEDGER_FILE), `${header}\n${body.join('\n')}\n`, 'utf8');
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
  mood?: string;
  formality?: string;
}) {
  if (morph.verbForm === 'gerund') return 'ger';
  if (morph.verbForm === 'participle') return 'part';
  const plural = morph.number === 'plural';
  // A command has no tense, so it is keyed by who it is addressed to instead.
  if (morph.mood === 'imperative') {
    const audience = plural
      ? morph.formality === 'formal'
        ? 'ustedes'
        : 'vosotros'
      : morph.formality === 'formal'
        ? 'usted'
        : 'tu';
    return `cmd-${audience}`;
  }
  const tense = { present: 'pres', preterite: 'pret', imperfect: 'imp' }[morph.tense ?? ''] ?? 'x';
  return `${tense}-${morph.person}${plural ? 'p' : 's'}`;
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

const verbLemmaOf = new Map(verbLexemes.map((lexeme) => [lexeme.id, lexeme.lemma]));
const isCommand = (form: FormRecord) => form.morph['mood'] === 'imperative';

for (const form of verbForms.filter((entry) => !isCommand(entry))) {
  const lemma = verbLemmaOf.get(form.lexeme);
  if (lemma) index(form.form, { lexeme: form.lexeme, lemma, pos: 'VERB', morph: form.morph });
}

/**
 * A noun's plural and an adjective's agreement forms, as records rather than as
 * index entries that evaporate.
 *
 * `pluralOf` and `adjectiveForms` have generated these since the pack existed,
 * and the build used the result only to link `verduras` in a sentence back to
 * `verdura`. Nothing shipped, so nothing could show it: `formsOf` had verb forms
 * to read and nothing else, which is why tapping a noun answered "what does it
 * mean" but never "what is its plural" — the one question a Spanish noun always
 * raises. The forms were already computed; only the emitting was missing.
 *
 * The surface index is then driven from these same records, so what a learner
 * can be shown and what a sentence can link to cannot drift apart.
 */
interface NominalForm extends FormRecord {
  /** Carried so the surface index and the record are built from one pass. */
  lemma: string;
  pos: 'NOUN' | 'ADJ';
}

const nominalForms: NominalForm[] = [
  ...nouns.flatMap((noun): NominalForm[] => {
    const lexeme = lexemeId(noun.lemma, 'NOUN');
    const gender = noun.gender === 'f' ? 'feminine' : 'masculine';
    const key = slug(noun.lemma);
    // A form of `papa` is as regional as the lexeme: the plural of a word a
    // learner should not be taught is not a word either.
    const regions = noun.regions.length > 0 ? { regions: noun.regions } : {};
    return [
      {
        id: `${NS}form:${key}-n-sg`,
        lexeme,
        lemma: noun.lemma,
        pos: 'NOUN',
        form: noun.lemma,
        morph: { gender, number: 'singular' },
        level: noun.level,
        ...regions,
      },
      {
        id: `${NS}form:${key}-n-pl`,
        lexeme,
        lemma: noun.lemma,
        pos: 'NOUN',
        // An irregular plural is declared (examen → exámenes, and the invariable
        // lunes); everything else is derived.
        form: noun.plural || pluralOf(noun.lemma),
        morph: { gender, number: 'plural' },
        level: noun.level,
        ...regions,
      },
    ];
  }),
  ...modifiers
    .filter((modifier) => modifier.pos === 'ADJ')
    .flatMap((modifier): NominalForm[] => {
      const lexeme = lexemeId(modifier.lemma, 'ADJ');
      const key = slug(modifier.lemma);
      return adjectiveForms(modifier.lemma).map((entry) => ({
        // Keyed by the agreement it *is*, not by its position in the list, so a
        // record keeps its id whether or not the adjective has a feminine.
        id: `${NS}form:${key}-a-${entry.morph.gender?.[0] ?? 'x'}${entry.morph.number === 'plural' ? 'pl' : 'sg'}`,
        lexeme,
        lemma: modifier.lemma,
        pos: 'ADJ' as const,
        form: entry.form,
        morph: { ...entry.morph },
        level: modifier.level,
      }));
    }),
];

for (const form of nominalForms) {
  index(form.form, {
    lexeme: form.lexeme,
    lemma: form.lemma,
    pos: form.pos,
    morph: form.morph,
  });
}

/**
 * The same forms without the two fields that were only there to build the index.
 * `lemma` and `pos` are already on the lexeme a form points at, and a record
 * that repeats them is a record that can disagree with it.
 */
const packedNominalForms: FormRecord[] = nominalForms.map(
  ({ lemma: _lemma, pos: _pos, ...record }) => record,
);

/*
 * The declared extra surfaces, for every modifier including the adjectives.
 *
 * An adjective's *agreement* forms are derived above, but its apocopated one is
 * not: `buen`, `gran` and `mal` are shortenings, not agreements, and no rule in
 * `morphology.ts` produces them. Dropping this loop for adjectives on the
 * grounds that `nominalForms` already covered them cost `buen` seven links and
 * `gran` one — and quietly handed `mal tiempo` to the adverb, which is worse,
 * because an unlinked token is visible in the coverage report and a wrong one is
 * not. The citation form is indexed here too for the non-adjectives, which have
 * no derived forms at all.
 */
for (const modifier of modifiers) {
  const lexeme = lexemeId(modifier.lemma, modifier.pos);
  const citation = modifier.pos === 'ADJ' ? [] : [{ form: modifier.lemma, morph: {} }];
  const declared = modifier.forms.map((form) => ({ form, morph: {} }));
  for (const { form, morph } of [...citation, ...declared]) {
    index(form, { lexeme, lemma: modifier.lemma, pos: modifier.pos, morph });
  }
}

/**
 * An ordinal's shortened form, derived from the same module that spells it.
 *
 * `el primer día` is the form a learner meets most and the one they have to
 * produce, and it used to be typed into the extra-surfaces column beside
 * `primero`. It is not a *record*: `primer` and `primero` are both masculine
 * singular, so the two would be indistinguishable in a paradigm list, and
 * inventing a morphology field for one language's ordinals to fix that would put
 * a Spanish detail in a model shared by every pack. So the shortened form is
 * indexed and the pattern below is what teaches it.
 */
for (const [lemma, value] of ordinalValues) {
  const shortened = spellOrdinal(value, { beforeNoun: true });
  if (shortened === lemma) continue;
  index(shortened, {
    lexeme: lexemeId(lemma, 'ADJ'),
    lemma,
    pos: 'ADJ',
    morph: { gender: 'masculine', number: 'singular' },
  });
}

/**
 * Commands go in last, and only where they cannot outbid a word that is already
 * claimed: `sé` is `saber` far more often than a command to *be*, `entre` is the
 * preposition, and `limpia` is the adjective. Indexing them earlier made all
 * three ambiguous and cost more links than the commands gained.
 *
 * Within one lexeme the overlap is harmless — `cierra` is `cerrar` either way —
 * and which reading a sentence means is settled later by `retagCommand`, from
 * the address the author declared.
 */
for (const form of verbForms.filter(isCommand)) {
  const lemma = verbLemmaOf.get(form.lexeme);
  if (!lemma) continue;
  const claimants = surfaces.get(form.form.toLowerCase()) ?? [];
  if (claimants.some((entry) => entry.lexeme !== form.lexeme)) continue;
  index(form.form, { lexeme: form.lexeme, lemma, pos: 'VERB', morph: form.morph });
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
  register?: string;
  address?: string;
  regions?: string[];
  topics?: string[];
  tokens?: Token[];
  annotations?: Annotation[];
  lexemes?: string[];
  skills?: string[];
  examples?: string[];
  note?: string;
  /** Present only where a human has signed the item off; see reviewed.tsv. */
  provenance?: { source: string; review: string };
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
 * "el trabajo" and the verb in "trabajo en una oficina"; the words around it
 * decide. When the cues are missing or several candidates survive, the token is
 * left unlinked — a wrong lemma is worse than a missing one.
 */
function disambiguate(
  candidates: SurfaceEntry[],
  previous: Token | undefined,
  next: string | undefined,
): SurfaceEntry | null {
  if (candidates.length === 0) return null;

  // Several entries for one lexeme (lunes singular and plural are identical)
  // are not an ambiguity at all.
  if (new Set(candidates.map((entry) => entry.lexeme)).size === 1) return candidates[0]!;

  // Nothing follows, so no noun can follow either, which rules out the
  // apocopated adjective: "canta muy mal" is the adverb, "un mal día" is not.
  if (next === undefined || PUNCTUATION.has(next)) {
    const adverbs = candidates.filter((entry) => entry.pos === 'ADV');
    if (adverbs.length === 1) return adverbs[0]!;
  }

  const previousText = previous?.text.toLowerCase() ?? '';
  const afterNominalCue = NOMINAL_CUES.has(previousText);
  // A noun is also the likely reading straight after a verb or a preposition:
  // "bebemos vino", "en casa". `hay` is checked by part of speech because it is
  // declared as a bare surface form and carries no morphology.
  const afterVerbOrPreposition =
    previous?.morph?.['verbForm'] === 'finite' ||
    previous?.pos === 'VERB' ||
    previous?.pos === 'ADP';
  const nominalPosition = afterNominalCue || afterVerbOrPreposition;

  const preferred = nominalPosition
    ? candidates.filter(
        (entry) => entry.pos === 'NOUN' || entry.pos === 'ADJ' || entry.pos === 'PRON',
      )
    : candidates.filter((entry) => entry.pos === 'VERB');

  if (preferred.length === 1) return preferred[0]!;

  /*
   * An ordinal immediately before a noun is the ordinal, whatever else shares
   * its spelling: `el segundo piso` is the second floor, `espera un segundo` is
   * a second of time. Both sit in nominal position after a determiner, so the
   * head rule below cannot tell them apart — and it picked the noun, which is
   * how the pack shipped a floor number linked to a unit of time.
   *
   * Narrowed to ordinals rather than expressed as "an adjective before a noun
   * is an adjective", which is the tempting general rule and the wrong one: it
   * would reopen `la cara` and `mucho frío`, the exact cases the head rule is
   * here to settle.
   */
  if (next !== undefined && isNoun(next)) {
    const ordinals = preferred.filter(
      (entry) => entry.pos === 'ADJ' && ordinalValues.has(entry.lemma),
    );
    if (ordinals.length === 1) return ordinals[0]!;
  }

  // The head of a noun phrase wins over the adjective that happens to share its
  // form: "la cara", "mucho frío", "tengo frío".
  const heads = preferred.filter((entry) => entry.pos === 'NOUN' || entry.pos === 'PRON');
  if (nominalPosition && heads.length === 1) return heads[0]!;

  return null;
}

/** Whether any lexeme claims this surface as a noun — "does a noun follow?". */
function isNoun(surface: string): boolean {
  return (surfaces.get(surface.toLowerCase()) ?? []).some((entry) => entry.pos === 'NOUN');
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
    const entry = disambiguate(candidates, tokens.at(-1), matches[position + 1]);
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
  {
    skill: `${NS}skill:ordinals`,
    label: 'primero, segundo, tercero',
    gloss:
      'ordinals agree like adjectives, and primero and tercero shorten before a masculine noun',
    level: 'a1',
    match: (tokens, i) => {
      const token = tokens[i];
      if (!token || token.pos !== 'ADJ' || token.lemma === undefined) return null;
      return ordinalValues.has(token.lemma) ? [token.id] : null;
    },
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

/**
 * Asking, as a *form* rather than as a situation.
 *
 * Twenty-five authored skills are about asking something — the price, the way,
 * who someone is — and every one of them is a situation. Not one said how a
 * Spanish question is *built*, though the pack holds hundreds. So a learner met
 * hundreds of questions and was never told the rule, which for an English
 * speaker is the single most useful sentence in the language:
 *
 *   **A yes/no question is the statement itself.** No inversion, no auxiliary,
 *   no `do`. `Tienes tiempo.` and `¿Tienes tiempo?` are the same four letters of
 *   difference — the marks and the intonation. English speakers arrive expecting
 *   to move the verb or add a word, and produce neither Spanish nor sense.
 *
 * That is a `grammar` skill rather than a `pattern` for the same reason
 * `imperativo` is: it classifies the whole utterance rather than naming a
 * construction inside it. It also puts asking beside commanding in the Grammar
 * section, which is where a learner comparing "what kind of thing am I saying"
 * would look for it.
 *
 * Statements get no skill of their own: most items are statements, so the label
 * would carry no information — the contrast is taught in the glosses of the two
 * that do. Counts are deliberately not written here; the build prints the live
 * ones, and a number in a comment is a number that goes stale.
 */
const QUESTION_SKILLS = {
  'yes-no-question': {
    id: `${NS}skill:yes-no-question`,
    label: '¿Tienes tiempo?',
    gloss:
      'a yes/no question is the statement itself — Spanish adds no word and moves nothing, only ¿ ? and the rising intonation',
    level: 'a1',
  },
  'question-word': {
    id: `${NS}skill:question-word`,
    label: '¿Dónde…? ¿Cuándo…?',
    gloss:
      'a question word opens the question — after «y» or a preposition if there is one — and the verb follows it directly, with no extra word between',
    level: 'a1',
  },
} as const;

/**
 * The interrogatives, read off the content rather than listed here.
 *
 * `content/es/topics.tsv` registers `questions` and the nine question words are
 * the rows that carry it, so the closed class is already declared where a human
 * maintains it. Narrowed to `PRON` and `ADV` because a question word is one or
 * the other, which stops an ordinary noun about asking from joining the set if
 * someone files one under that topic later.
 */
const INTERROGATIVES = new Set(
  modifiers
    .filter(
      (modifier) =>
        modifier.topics.includes('questions') &&
        (modifier.pos === 'PRON' || modifier.pos === 'ADV'),
    )
    .map((modifier) => modifier.lemma),
);

/**
 * Which of the two shapes a question has — or neither, when the shape is
 * genuinely ambiguous.
 *
 * `disambiguate` returns `null` rather than guessing which lexeme a surface is,
 * and a test asserts that `Fuimos` stays unlinked: **a missing label beats a
 * wrong one**. The same rule applies here, and it has to, because the whole
 * purpose of these two skills is telling asking-shapes apart. A learner
 * practising `yes-no-question` on a `dónde` question is being taught the
 * opposite of the thing.
 *
 * So three outcomes, not two:
 *
 * - **Opens with an interrogative** → `question-word`. Stepping over at most one
 *   conjunction, then one preposition, then one comma-delimited topic, in the
 *   order Spanish puts them: `¿Y de dónde eres?`, `¿Y tú, de dónde eres?`.
 * - **Holds no interrogative at all** → `yes-no-question`. Nothing else it can
 *   be, and this is the shape worth teaching: the statement, unchanged.
 * - **Holds one somewhere else** → neither, and deliberately. `¿Sabes qué hora
 *   es?` answers sí, and `¿Y el medio kilo cuánto es?` answers a price, and
 *   nothing local separates an embedded question from a topicalised one. Word
 *   order is what `retagCommand` refuses to guess from for the same reason.
 */
function questionSkill(tokens: Token[]): string | undefined {
  const opening = tokens.findIndex((token) => token.text === '¿');
  const asked = tokens.slice(opening + 1).filter((token) => token.text !== '?');
  const isInterrogative = (token: Token | undefined) =>
    token?.lemma !== undefined && INTERROGATIVES.has(token.lemma);

  /*
   * Every position the interrogative is allowed to open from, tested together
   * rather than walked one step at a time. Advancing greedily skipped past the
   * answer: `¿Y de dónde eres, Elena?` reaches `dónde` after the conjunction and
   * the preposition, and the comma rule then stepped over it to the vocative.
   */
  const heads = [0];
  let at = 0;
  if (asked[at]?.pos === 'CCONJ') heads.push((at += 1));
  if (asked[at]?.pos === 'ADP') heads.push((at += 1));
  // A topicalised subject, which Spanish puts before the question word and marks
  // with a comma: `¿Y usted, en qué trabaja?`. Bounded to a short phrase, so an
  // ordinary clause cannot be walked past.
  const comma = asked.findIndex((token) => token.text === ',');
  if (comma > at && comma <= at + 2) {
    heads.push(comma + 1);
    if (asked[comma + 1]?.pos === 'ADP') heads.push(comma + 2);
  }

  if (heads.some((index) => isInterrogative(asked[index]))) {
    return QUESTION_SKILLS['question-word'].id;
  }
  return asked.some(isInterrogative) ? undefined : QUESTION_SKILLS['yes-no-question'].id;
}

/**
 * Commands are a mood rather than a tense, so they are not in TENSE_SKILLS —
 * but they are just as practisable, and a beginner meets them constantly.
 */
const IMPERATIVE_SKILL = {
  id: `${NS}skill:imperative`,
  label: 'imperativo',
  gloss: 'telling someone to do something',
  level: 'a1',
};

/**
 * The numeral rules as practisable skills, one per rule in `numerals.ts`.
 *
 * Typed as a `Record<NumeralRule, …>`, so adding a rule to the module without
 * giving it a label fails the typecheck. That is a stronger guarantee than a
 * runtime check in this script and it fires earlier — `npm run check` catches it
 * before the build ever runs.
 */
const NUMERAL_SKILLS: Record<NumeralRule, { label: string; gloss: string; level: string }> = {
  teens: {
    label: 'dieciséis, diecisiete…',
    gloss: 'the teens, written as one word',
    level: 'a1',
  },
  twenties: {
    label: 'veintiuno, veintidós…',
    gloss: 'the twenties, written as one word',
    level: 'a1',
  },
  'y-joining': {
    label: 'treinta y uno / ciento uno',
    gloss: 'y joins tens to units, and never hundreds to tens',
    level: 'a1',
  },
  apocopation: {
    label: 'veintiún libros',
    gloss: 'uno shortens to un before a masculine noun',
    level: 'a2',
  },
  'hundreds-agreement': {
    label: 'doscientas casas',
    gloss: 'the hundreds agree in gender',
    level: 'a2',
  },
  'cien-ciento': {
    label: 'cien mil / ciento treinta',
    gloss: 'cien alone, ciento in a compound',
    level: 'a2',
  },
  'mil-millon': {
    label: 'mil / un millón de',
    gloss: 'a thousand is never un mil; a million is a noun',
    level: 'a2',
  },
};

const numeralSkillId = (rule: NumeralRule): string => `${NS}skill:numerals-${rule}`;

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
    const morph = token.morph as
      { person?: number; number?: string; formality?: string } | undefined;
    if (morph?.person !== 2) continue;
    const plural = morph.number === 'plural';
    // A command states who it is aimed at outright, which is why `Siga` yields
    // usted where no indicative form could: usted takes third-person morphology.
    if (morph.formality === 'formal') return plural ? 'ustedes' : 'usted';
    return plural ? 'vosotros' : 'tu';
  }
  return '';
}

/**
 * A tú command is spelled exactly like the third person present — `cierra la
 * puerta` and `la tienda cierra a las dos` differ only in what they mean, and
 * the linker cannot see the difference.
 *
 * So the build does not guess. It trusts the author: a sentence that declares
 * who it is spoken to, and is not a question, is read as a command when it opens
 * with a verb that has that very command form. Everything else stays indicative,
 * which is why weather verbs (`Hace frío`) and statements (`Está muy cerca`) are
 * unaffected.
 */
function retagCommand(tokens: Token[], sentence: SentenceRow): void {
  if (!sentence.address) return;
  const text = sentence.text.trim();
  if (text.startsWith('¿') || text.endsWith('?')) return;

  const opening = tokens.find((token) => token.pos !== 'PUNCT');
  if (!opening?.lexeme || opening.morph?.['mood'] !== 'indicative') return;

  // The command must be the one the declared address asks for. Without this,
  // "Está muy cerca. Siga por esta calle." — declared usted — would match
  // estar's *tú* command, which is spelled `está`, and mislabel a statement.
  const wanted = COMMAND_AUDIENCE[sentence.address];
  if (!wanted) return;

  const command = verbForms.find(
    (form) =>
      form.lexeme === opening.lexeme &&
      isCommand(form) &&
      form.form.toLowerCase() === opening.text.toLowerCase() &&
      form.morph['number'] === wanted.number &&
      form.morph['formality'] === wanted.formality,
  );
  if (command) opening.morph = command.morph;
}

const COMMAND_AUDIENCE: Record<string, { number: string; formality: string } | undefined> = {
  tu: { number: 'singular', formality: 'informal' },
  usted: { number: 'singular', formality: 'formal' },
  vosotros: { number: 'plural', formality: 'informal' },
  ustedes: { number: 'plural', formality: 'formal' },
};

const authoredSkillId = (slug: string): string => `${NS}skill:${slug}`;

const sentenceItems: ItemRecord[] = sentences.map((sentence) => {
  const tokens = tokenise(sentence.text);
  retagCommand(tokens, sentence);
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
  for (const slug of sentence.skills) {
    const id = authoredSkillId(slug);
    skills.add(id);
    usedSkills.add(id);
  }
  // The sentence's own mood, before the tokens' — `¿` is orthography Spanish
  // requires, so it is the most reliable fact about a sentence in the file.
  if (sentence.text.includes('¿')) {
    const skill = questionSkill(tokens);
    // `undefined` where the shape is ambiguous — see `questionSkill`.
    if (skill) {
      skills.add(skill);
      usedSkills.add(skill);
    }
  }

  for (const token of tokens) {
    const tense = token.morph?.['tense'];
    if (typeof tense === 'string' && TENSE_SKILLS[tense]) {
      skills.add(TENSE_SKILLS[tense]!.id);
      usedSkills.add(TENSE_SKILLS[tense]!.id);
    }
    if (token.morph?.['mood'] === 'imperative') {
      skills.add(IMPERATIVE_SKILL.id);
      usedSkills.add(IMPERATIVE_SKILL.id);
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
    id: itemId(sentence.row),
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

// ── passages (several sentences read as one text) ────────────────────────────

/**
 * A passage is a container over sentences that stay individually practisable, so
 * nothing here touches the item records — it only references them in order.
 * Membership is authored on the sentence rows, which keeps a paragraph together
 * in the file a human is reading.
 */
interface PassageRecord {
  id: string;
  pack: string;
  kind: string;
  title: string;
  level?: string;
  topics?: string[];
  regions?: string[];
  items: string[];
  speakers?: string[];
}

const itemById = new Map(sentenceItems.map((item, index) => [sentences[index]!, item]));
const passageProblems: string[] = [];
const declaredKeys = new Set(passageRows.map((passage) => passage.key));

for (const sentence of sentences) {
  if (sentence.passage && !declaredKeys.has(sentence.passage)) {
    passageProblems.push(
      `"${sentence.text}" claims passage "${sentence.passage}", which passages.tsv does not declare`,
    );
  }
}

const passageRecords: PassageRecord[] = passageRows.map((passage) => {
  const members = sentences.filter((sentence) => sentence.passage === passage.key);

  if (members.length < 2) {
    passageProblems.push(
      `passage "${passage.key}" has ${members.length} sentence(s); a passage needs at least two`,
    );
  }
  if (!(PASSAGE_KINDS as readonly string[]).includes(passage.kind)) {
    passageProblems.push(`passage "${passage.key}" has unknown kind "${passage.kind}"`);
  }
  if (passage.kind === 'dialogue' && members.some((member) => !member.speaker)) {
    passageProblems.push(`dialogue "${passage.key}" has a line with no speaker`);
  }
  if (passage.kind === 'text' && members.some((member) => member.speaker)) {
    passageProblems.push(`passage "${passage.key}" is not a dialogue but names a speaker`);
  }

  const items = members.map((member) => itemById.get(member)!);
  // A passage is only readable where all of its sentences are, so it inherits
  // the union of their regional limits rather than none of them.
  const regions = [...new Set(items.flatMap((item) => item.regions ?? []))];

  return {
    id: passageEntityId(passage.row),
    pack: PACK_ID,
    kind: passage.kind,
    title: passage.title,
    ...(passage.level ? { level: passage.level } : {}),
    ...(passage.topics.length > 0 ? { topics: passage.topics } : {}),
    ...(regions.length > 0 ? { regions } : {}),
    items: items.map((item) => item.id),
    ...(passage.kind === 'dialogue' ? { speakers: members.map((member) => member.speaker) } : {}),
  };
});

if (passageProblems.length > 0) {
  console.error('Passage problems:\n  ' + passageProblems.join('\n  '));
  process.exit(1);
}

// ── vocabulary items (one card per noun, adjective and numeral) ─────────────

const examplesByLexeme = new Map<string, string[]>();
for (const item of sentenceItems) {
  for (const lexeme of item.lexemes ?? []) {
    const existing = examplesByLexeme.get(lexeme);
    if (existing) existing.push(item.id);
    else examplesByLexeme.set(lexeme, [item.id]);
  }
}

const vocabularySources = [
  ...nouns
    .filter((noun) => !noun.row.noCard)
    .map((noun) => ({
      id: itemId(noun.row),
      lemma: noun.lemma,
      pos: 'NOUN',
      level: noun.level,
      topics: noun.topics,
      // A word card *is* the word, so it inherits whatever marks the lexeme:
      // `papa` must not be offered to someone learning the Spanish of Spain.
      regions: noun.regions,
      register: noun.register,
    })),
  ...verbs
    .filter((verb) => !verb.row.noCard)
    .map((verb) => ({
      id: itemId(verb.row),
      lemma: verb.lemma,
      pos: 'VERB',
      level: verb.level,
      topics: verb.topics,
      // A verb card is an infinitive: nothing about it is regional or marked for
      // register, and its forms are generated rather than authored.
      regions: [] as string[],
      register: '',
    })),
  ...modifiers
    .filter((modifier) => !modifier.row.noCard && CARD_POS.has(modifier.pos))
    .map((modifier) => ({
      id: itemId(modifier.row),
      lemma: modifier.lemma,
      // Carried through rather than assumed: a numeral card must not claim to be
      // an adjective, or its lexeme link points at a word that does not exist.
      pos: modifier.pos,
      level: modifier.level,
      topics: modifier.topics,
      regions: [] as string[],
      register: '',
    })),
];

const vocabularyItems: ItemRecord[] = vocabularySources.map((entry) => {
  const lexeme = lexemeId(entry.lemma, entry.pos);
  const examples = (examplesByLexeme.get(lexeme) ?? []).slice(0, 3);
  return {
    id: entry.id,
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

// ── no two items may carry the same text ────────────────────────

/**
 * Two items with identical text split a learner in half: progress, mastery and
 * scheduling all key on the item id, so the same word or sentence would be
 * practised twice and known once. Easy to introduce by accident when writing a
 * passage around sentences that already exist — or when a noun and an adjective
 * share a surface form, which is why word cards are checked here as well, and
 * against the sentences rather than only against each other.
 *
 * **Mood is part of the identity, and punctuation is otherwise not.** Stripping
 * the marks is what catches `Hola` against `Hola.`, and it also declared
 * `Tu hermano trabaja aquí.` a duplicate of `¿Tu hermano trabaja aquí?` — which
 * is the one pair the pack most needs to be able to hold. They are two sentences
 * to learn, not one written twice: different intonation, different function,
 * different reply, and for an English speaker the whole lesson is that the words
 * did not change. So the key carries the mood, and the marks that *declare* the
 * mood keep their meaning while the rest stay noise.
 */
const textOwners = new Map<string, string[]>();
for (const [item, origin] of [
  ...sentenceItems.map((item, index) => [item, sentences[index]!.source] as const),
  ...vocabularyItems.map((item) => [item, 'word card'] as const),
]) {
  const key =
    `${sentenceMood(item.text)}:` +
    item.text
      .toLowerCase()
      .replace(/[¿¡?!.,;:]/g, '')
      .trim();
  const owners = textOwners.get(key);
  const label = `${item.id} (${origin})`;
  if (owners) owners.push(label);
  else textOwners.set(key, [label]);
}

const duplicateTexts = [...textOwners.entries()].filter(([, owners]) => owners.length > 1);
if (duplicateTexts.length > 0) {
  console.error(
    'Duplicate item text — reword one, have the passage reference the existing item,\n' +
      `or mark the row that should not own a card with "${NO_CARD}" in its id column:\n  ` +
      duplicateTexts.map(([text, owners]) => `"${text}" → ${owners.join(', ')}`).join('\n  '),
  );
  process.exit(1);
}

// ── editorial sign-off ─────────────────────────

/**
 * `reviewed.tsv` is the one file in `content/es` a human writes *about* content
 * rather than writing content. The pack ships `review: unreviewed`; an entry
 * marks a single item `reviewed`, so an editorial pass can land a slice at a
 * time instead of all 1,027 items at once.
 *
 * The approved wording is recorded beside the id and compared here, because an
 * id deliberately survives a typo fix — which would otherwise let an edited row
 * keep an approval nobody gave it.
 */
const REVIEW_FILE = 'reviewed.tsv';

interface ReviewEntry {
  id: string;
  text: string;
  reviewer: string;
}

const reviewEntries: ReviewEntry[] = existsSync(join(CONTENT_DIR, REVIEW_FILE))
  ? readFileSync(join(CONTENT_DIR, REVIEW_FILE), 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0 && !line.startsWith('#'))
      .map((line) => {
        const [id, text, reviewer] = line.split('\t').map((cell) => cell.trim());
        return { id: id ?? '', text: text ?? '', reviewer: reviewer ?? '' };
      })
  : [];

const itemsById = new Map([...sentenceItems, ...vocabularyItems].map((item) => [item.id, item]));
const reviewProblems: string[] = [];

for (const entry of reviewEntries) {
  const item = itemsById.get(`${NS}item:${entry.id}`);
  if (!item) {
    reviewProblems.push(`${entry.id} is signed off, but no item claims that id any more`);
  } else if (item.text !== entry.text) {
    reviewProblems.push(
      `${entry.id} changed after sign-off: reviewed "${entry.text}", now "${item.text}"`,
    );
  } else if (!entry.reviewer) {
    reviewProblems.push(`${entry.id} has no reviewer — sign-off needs a name`);
  } else {
    item.provenance = { source: 'generated', review: 'reviewed' };
  }
}

if (reviewProblems.length > 0) {
  console.error(
    `Editorial sign-off problems in ${REVIEW_FILE} — re-read the row, then update its entry:\n  ` +
      reviewProblems.join('\n  '),
  );
  process.exit(1);
}

const reviewedCount = reviewEntries.length - reviewProblems.length;

// ── skills and translations ─────────────────────────────────────────────────

interface SkillRecord {
  id: string;
  kind: string;
  label: string;
  level: string;
  prerequisites?: string[];
}

const derivedSkillRecords: SkillRecord[] = [
  ...PATTERNS.map((pattern) => ({
    id: pattern.skill,
    kind: 'pattern',
    label: pattern.label,
    level: pattern.level,
  })),
  ...[...Object.values(TENSE_SKILLS), IMPERATIVE_SKILL, ...Object.values(QUESTION_SKILLS)].map(
    (skill) => ({
      id: skill.id,
      kind: 'grammar',
      label: skill.label,
      level: skill.level,
    }),
  ),
].filter((skill) => usedSkills.has(skill.id));

const authoredSkillRecords: SkillRecord[] = authoredSkillRows
  .map((skill) => ({
    id: authoredSkillId(skill.slug),
    kind: skill.kind,
    label: skill.label,
    level: skill.level,
    ...(skill.prerequisites.length
      ? { prerequisites: skill.prerequisites.map(authoredSkillId) }
      : {}),
  }))
  .filter((skill) => usedSkills.has(skill.id));

// Numeral skills are declared rather than discovered. Every other skill here
// is emitted only if an item uses it, but the numeral drill's targets are
// generated on demand — 1042 exists in no pack — so nothing would ever mark
// these used, and the attempts the drill records need them to exist.
const numeralSkillRecords: SkillRecord[] = NUMERAL_RULES.map((rule) => ({
  id: numeralSkillId(rule),
  kind: 'pattern',
  label: NUMERAL_SKILLS[rule].label,
  level: NUMERAL_SKILLS[rule].level,
}));

const skillRecords: SkillRecord[] = [
  ...derivedSkillRecords,
  ...authoredSkillRecords,
  ...numeralSkillRecords,
];

const skillGlosses = new Map<string, string>([
  ...PATTERNS.map((pattern) => [pattern.skill, pattern.gloss] as const),
  ...[...Object.values(TENSE_SKILLS), IMPERATIVE_SKILL, ...Object.values(QUESTION_SKILLS)].map(
    (skill) => [skill.id, skill.gloss] as const,
  ),
  ...authoredSkillRows.map((skill) => [authoredSkillId(skill.slug), skill.gloss] as const),
  ...NUMERAL_RULES.map((rule) => [numeralSkillId(rule), NUMERAL_SKILLS[rule].gloss] as const),
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
    // Same decoration as the card: tapping `treinta` in a sentence should show
    // "(30)" too, and this is the only gloss the 22 uncarded numerals ever get.
    text: glossOf(modifier.lemma, modifier.pos),
  })),
  ...skillRecords.map((skill) => ({
    ref: skill.id,
    lang: 'en',
    text: skillGlosses.get(skill.id) ?? skill.label,
  })),
  // A passage title is target-language text like any other, so its reference
  // translation is a separate record rather than a field.
  ...passageRows
    .filter((passage) => passage.titleTranslation)
    .map((passage) => ({
      ref: passageEntityId(passage.row),
      lang: 'en',
      text: passage.titleTranslation,
      type: 'natural',
    })),
];

function glossOf(lemma: string, pos: string): string {
  if (pos === 'NOUN') return nouns.find((noun) => noun.lemma === lemma)!.gloss;
  /*
   * A verb gloss comes from verbs.tsv — but not every VERB lexeme is a row
   * there. `hay` is declared in modifiers.tsv, because it is a form rather
   * than a conjugatable lemma and nothing would generate it. So this looks
   * and falls through, instead of asserting and dying on the one verb in the
   * pack that lives somewhere else.
   */
  const verb = pos === 'VERB' ? verbs.find((candidate) => candidate.lemma === lemma) : undefined;
  if (verb) return verb.gloss;
  const gloss = modifiers.find((modifier) => modifier.lemma === lemma)!.gloss;

  // A numeral's gloss carries its digits. Without them the exercises drill a
  // translation rather than a number: "twenty → veinte" is a vocabulary question
  // a learner half-answers from English, while "20 → veinte" is the real cue,
  // and it is the one they will meet on a price tag. Derived, never authored, so
  // the digits cannot disagree with the word beside them.
  const value = numeralValues.get(lemma);
  if (value !== undefined) return `${gloss} (${value})`;

  // An ordinal's digits for the same reason, in the notation a learner reads
  // them in: "second (2nd)" separates the ordinal from the noun that shares its
  // spelling, which no English gloss of `segundo` can do on its own.
  const ordinal = ordinalValues.get(lemma);
  return ordinal === undefined ? gloss : `${gloss} (${ordinalDigits(ordinal)})`;
}

/** `1st`, `2nd`, `3rd`, `4th` — the suffix English picks by the final digit. */
function ordinalDigits(value: number): string {
  const teens = value % 100;
  if (teens >= 11 && teens <= 13) return `${value}th`;
  return `${value}${['th', 'st', 'nd', 'rd'][value % 10] ?? 'th'}`;
}

// ── audio ───────────────────────────────────────────────────────────────────

/**
 * Canonical audio, from the ledger `generate-audio.ts` writes.
 *
 * The two halves of the pipeline meet here and nowhere else: the generator owns
 * synthesis and never touches the pack, and this reads what it recorded and
 * never synthesises. So a voice can be added, reviewed, replaced or dropped
 * without a byte of content changing — which is also what keeps a pack an
 * exportable, self-contained unit.
 *
 * Three rules, all of them consequences of the ledger's shape:
 *
 * 1. **Only `approved` clips ship.** The point of a ledger with a column a human
 *    owns is that nothing reaches a learner unheard. A row still marked
 *    `pending`, `redo` or `failed` is work in progress, not content.
 * 2. **The text hash travels with the clip.** An item keeps its id through a typo
 *    fix, so the hash is the only thing that can tell a current clip from one
 *    still pronouncing the old wording.
 * 3. **One file per locale.** A locale can then be dropped from a build by
 *    removing one manifest entry, and each file stays small enough to read.
 *
 * No ledger, no audio: the pack ships exactly as it does today, which is why
 * this can land before a single clip exists.
 */
interface AudioLedgerRow {
  readonly item: string;
  readonly locale: string;
  readonly voice: string;
  readonly textHash: string;
  readonly file: string;
  readonly durationMs: string;
  readonly review: string;
}

const AUDIO_LEDGER_FILE = 'audio-ledger.tsv';

function readAudioLedger(): AudioLedgerRow[] {
  if (!existsSync(join(CONTENT_DIR, AUDIO_LEDGER_FILE))) return [];
  return readRows(AUDIO_LEDGER_FILE).flatMap((row) => {
    // The first column is an item's local id, which `readSource` recognises as an
    // id and strips — so the item comes off `row.id` rather than off the fields.
    const item = row.id;
    const [locale, voice, textHash, path, durationMs, , review] = row.fields;
    if (!item || !locale || !voice || !textHash || !path) return [];
    return [
      {
        item,
        locale,
        voice,
        textHash,
        file: path,
        durationMs: durationMs ?? '',
        review: review ?? '',
      },
    ];
  });
}

const audioLedger = readAudioLedger();
const approvedAudio = audioLedger.filter((row) => row.review === 'approved');

const audioClips = approvedAudio.flatMap((row) => {
  const item = `${PACK_ID}:item:${row.item}`;
  // A clip whose item no longer exists is stale rather than fatal: a row can
  // outlive the sentence it spoke, so it is dropped and counted below.
  if (!itemsById.has(item)) return [];
  return [
    {
      // Stable per (item, locale, voice), deliberately not per hash: a
      // re-recording of the same line in the same voice fills the same slot, and
      // an id that moved with the wording would be a new clip every typo fix.
      id: `${PACK_ID}:audio:${row.item}-${row.locale}-${row.voice}`,
      pack: PACK_ID,
      item,
      locale: row.locale,
      voice: row.voice,
      src: row.file,
      textHash: row.textHash,
      ...(row.durationMs ? { durationMs: Number(row.durationMs) } : {}),
      provenance: { source: 'generated', review: 'reviewed', revision: 1 },
    },
  ];
});

const audioLocales = [...new Set(audioClips.map((clip) => clip.locale))].sort();

/** A voice is a thing with provenance, so it is declared rather than inferred. */
interface VoiceRow {
  readonly id: string;
  readonly locale: string;
  readonly label: string;
  readonly provider: string;
  readonly license: string;
  readonly review: string;
}

const VOICES_FILE = 'voices.tsv';

const voiceRows: VoiceRow[] = existsSync(join(CONTENT_DIR, VOICES_FILE))
  ? readRows(VOICES_FILE).flatMap((row) => {
      const [id, locale, label, provider, license, review] = row.fields;
      if (!id || !locale) return [];
      return [
        {
          id,
          locale,
          label: label ?? id,
          provider: provider ?? '',
          license: license ?? '',
          review: review ?? 'unreviewed',
        },
      ];
    })
  : [];

// ── write ───────────────────────────────────────────────────────────────────

const files = [
  { kind: 'skills', path: 'es-a1-a2-core-skills.jsonl', records: skillRecords },
  { kind: 'lexemes', path: 'es-a1-a2-core-verbs.jsonl', records: clean(verbLexemes) },
  { kind: 'lexemes', path: 'es-a1-a2-core-nouns.jsonl', records: clean(nounLexemes) },
  { kind: 'lexemes', path: 'es-a1-a2-core-modifiers.jsonl', records: clean(modifierLexemes) },
  {
    kind: 'forms',
    path: 'es-a1-a2-core-forms.jsonl',
    records: [...verbForms, ...packedNominalForms],
  },
  { kind: 'items', path: 'es-a1-a2-core-vocabulary.jsonl', records: vocabularyItems },
  { kind: 'items', path: 'es-a1-a2-core-sentences.jsonl', records: sentenceItems },
  { kind: 'passages', path: 'es-a1-a2-core-passages.jsonl', records: passageRecords },
  { kind: 'translations', path: 'es-a1-a2-core-translations-en.jsonl', records: translations },
  ...audioLocales.map((locale) => ({
    kind: 'audio',
    path: `es-a1-a2-core-audio-${locale}.jsonl`,
    records: audioClips.filter((clip) => clip.locale === locale),
  })),
].filter((file) => file.records.length > 0);

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

const idsWrittenBack = writeBackIds();
writeLedger();

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
  // Authored in `content/es/pack.tsv`, beside the content it describes.
  version: packRow?.version ?? '0.0.0',
  description:
    'High-frequency Spanish verbs, nouns, modifiers and everyday sentences. Generated from content/es and not yet reviewed by a human editor.',
  license: 'CC0-1.0',
  levels: ['a1', 'a2'],
  referenceLanguages: ['en'],
  pronunciationLocales: ['es-ES', 'es-MX'],
  // Declared rather than inferred from the items: a category the pack means to
  // offer should still be nameable when it is briefly empty, and the app needs
  // a label and an order that no amount of scanning items could supply.
  ...(topicRows.length > 0
    ? {
        topics: topicRows.map((topic) => ({
          id: topic.slug,
          label: topic.label,
          ...(topic.group ? { group: topic.group } : {}),
        })),
      }
    : {}),
  /*
   * Voices are declared, not inferred from the clips. A voice carries its own
   * licence — generated speech is not automatically yours to redistribute — and
   * the settings picker needs a label that no amount of scanning files supplies.
   */
  ...(voiceRows.length > 0
    ? {
        voices: voiceRows.map((voice) => ({
          id: voice.id,
          locale: voice.locale,
          label: voice.label,
          ...(voice.provider ? { provider: voice.provider } : {}),
          ...(voice.license ? { license: voice.license } : {}),
          review: voice.review,
        })),
      }
    : {}),
  provenance: { source: 'generated', origin: 'content/es', review: 'unreviewed', revision: 1 },
  files: files.map((file) => ({ kind: file.kind, path: file.path })),
};

writeFileSync(join(OUT_DIR, 'pack.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

writeFileSync(
  join(PACKS_DIR, 'catalog.json'),
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
console.log(
  `  ${verbForms.length} verb forms · ${packedNominalForms.length} noun and adjective forms`,
);
console.log(`  ${sentenceItems.length} sentences · ${vocabularyItems.length} word cards`);
console.log(
  `  ${skillRecords.length} skills · ${translations.length} translations` +
    ` (${NUMERAL_RULES.length} numeral rules, declared rather than discovered)`,
);

const totalItems = sentenceItems.length + vocabularyItems.length;

/*
 * Named rather than failed, and for the same reason ids are written back rather
 * than demanded: the new count is not knowable until this build has run, so
 * refusing here would leave an author with no way to learn the number they are
 * being asked to supply. `npm run check` is where it bites.
 */
if (packRow && packRow.items !== totalItems) {
  console.log(
    `  pack version ${packRow.version} was cut at ${packRow.items} items, and this build has` +
      ` ${totalItems} — bump the version in ${PACK_FILE} and record ${totalItems}`,
  );
} else if (packRow) {
  console.log(`  pack version ${packRow.version}, cut at ${packRow.items} items`);
}

const reviewedShare = totalItems === 0 ? 0 : Math.round((reviewedCount / totalItems) * 100);
console.log(
  `  editorial review: ${reviewedCount}/${totalItems} items signed off (${reviewedShare}%)` +
    (reviewedCount === 0 ? ' — the pack is machine-generated and unreviewed' : ''),
);

if (passageRecords.length > 0) {
  const lines = passageRecords.reduce((total, passage) => total + passage.items.length, 0);
  const dialogues = passageRecords.filter((passage) => passage.kind === 'dialogue').length;
  console.log(
    `  ${passageRecords.length} passages (${dialogues} dialogues) · ` +
      `${lines} sentences read in context, ${(lines / passageRecords.length).toFixed(1)} per passage`,
  );
}

const retired = [...ledger.values()].filter((entry) => !claimed.has(entry.id)).length;
console.log(
  `\n  item ids: ${claimed.size} active, ${retired} retired` +
    (idsWrittenBack.length > 0 ? ` — assigned new ids in ${idsWrittenBack.join(', ')}` : ''),
);

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
// Numerals are counted apart rather than folded into "modifiers": 22 of them
// ship without an example sentence, and a single number jumping from 2 to 24
// reads as a regression when it is a new closed set arriving. It is still a real
// gap — `doscientos` deserves a sentence — so it stays in the report.
const numeralGap = byPos('NUM');
console.log(
  `  without an example: ${byPos('VERB')} verbs, ${byPos('NOUN')} nouns, ` +
    `${uncovered.length - byPos('VERB') - byPos('NOUN') - numeralGap} modifiers` +
    (numeralGap > 0 ? `, ${numeralGap} numerals` : ''),
);

if (topicRows.length > 0) {
  const perTopic = new Map(topicRows.map((topic) => [topic.slug, 0]));
  for (const item of [...sentenceItems, ...vocabularyItems]) {
    for (const topic of item.topics ?? []) perTopic.set(topic, (perTopic.get(topic) ?? 0) + 1);
  }

  const thin = [...perTopic].filter(([, count]) => count < TOPIC_FLOOR);
  console.log(
    `\n  categories: ${perTopic.size} registered, ` +
      `${[...perTopic.values()].filter((count) => count > 0).length} with content`,
  );
  // Named rather than counted: a category the picker offers and that then shows
  // three items is worse than one it does not offer at all, so the thin ones
  // have to be readable in the build output rather than merely tallied.
  if (thin.length > 0) {
    console.log(
      `  under ${TOPIC_FLOOR} items: ` +
        thin.map(([slug, count]) => `${slug} (${count})`).join(', '),
    );
  }
}
// ── the recycling ratchet ───────────────────────────────────────────────────

/**
 * A word met once is a word not learned, and this is the gate that says so.
 *
 * §5 of the dataset-expansion brief asked for a threshold the build *enforces*
 * rather than prints, and the reason is measured: two content passes in this
 * repository added one-encounter lexemes as fast as they fixed them, and the
 * coverage report reported it to nobody. A number in build output is not a gate.
 *
 * It is a ratchet rather than a target, for the reason `vite.config.ts` gives
 * about coverage floors: turning the real threshold on today would fail the
 * build on 397 A1 lexemes and block every other kind of work until the whole
 * content backlog was written. So `recycling.tsv` records where we are, the
 * build refuses to let it get worse, and refuses to let an improvement go
 * unrecorded either — which is what keeps the ceiling from going stale in the
 * direction that costs nothing to ignore.
 */
const recyclingRows = readRows('recycling.tsv').map((row) => {
  const [level, target, short, note] = row.fields;
  return {
    level: level ?? '',
    target: Number(target ?? 0),
    short: Number(short ?? 0),
    note: note ?? '',
    line: row.line,
  };
});

const encountersOf = (lexeme: { id: string }) => examplesByLexeme.get(lexeme.id)?.length ?? 0;
const recyclingProblems: string[] = [];

/**
 * The ratchet is a claim about the **shipped** dataset, so a scratch copy only
 * reports.
 *
 * A test that appends one row to exercise some other gate — the topic registry,
 * the review report — adds a lexeme with no contexts behind it, and would trip
 * this. That is a true statement about that scratch pack and a useless one: the
 * fixture is not the pack we ship. Requiring every such fixture to also write
 * six sentences would make an unrelated gate expensive to test, and the usual
 * escape — loosening the threshold until nothing trips it — would leave the
 * ratchet unable to bite at all.
 *
 * `LINGUASTEIN_CONTENT_DIR` is the signal rather than a bypass flag of its own:
 * the dataset fixture already sets it to mean "this is a scratch copy", and
 * nothing else does. `LINGUASTEIN_RECYCLING=enforce` forces the gate back on,
 * which is how the ratchet's own tests reach it.
 */
const recyclingMode =
  process.env['LINGUASTEIN_RECYCLING'] ??
  (process.env['LINGUASTEIN_CONTENT_DIR'] ? 'report' : 'enforce');

console.log('');
for (const rule of recyclingRows) {
  if (!Number.isFinite(rule.target) || rule.target < 1) {
    recyclingProblems.push(
      `recycling.tsv line ${rule.line}: "${rule.target}" is not a usable target`,
    );
    continue;
  }
  const atLevel = allLexemes.filter((lexeme) => lexeme.level === rule.level);
  const short = atLevel.filter((lexeme) => encountersOf(lexeme) < rule.target);
  console.log(
    `  recycling ${rule.level}: ${atLevel.length - short.length}/${atLevel.length} lexemes ` +
      `appear in ${rule.target}+ sentences — ${short.length} short`,
  );

  if (short.length > rule.short) {
    // Named, not just counted: the words that regressed are the work, and a
    // number alone sends a reader back to write this query themselves.
    const worst = [...short]
      .sort((a, b) => encountersOf(a) - encountersOf(b))
      .slice(0, 12)
      .map((lexeme) => `${lexeme.lemma} (${encountersOf(lexeme)})`);
    recyclingProblems.push(
      `recycling regressed for ${rule.level}: ${short.length} lexemes are short of ` +
        `${rule.target} sentences, up from ${rule.short}. Either give these an extra ` +
        `context or raise the ceiling on purpose: ${worst.join(', ')}` +
        (short.length > worst.length ? `, and ${short.length - worst.length} more` : ''),
    );
  } else if (short.length < rule.short) {
    recyclingProblems.push(
      `recycling improved for ${rule.level}: ${short.length} lexemes are short of ` +
        `${rule.target} sentences, down from ${rule.short} — record ${short.length} in ` +
        `recycling.tsv so the gain is kept`,
    );
  }
}

if (recyclingProblems.length > 0) {
  const enforcing = recyclingMode === 'enforce';
  const say = enforcing ? console.error : console.log;
  say(enforcing ? '\nRecycling:' : '\nRecycling (scratch copy — reporting only):');
  for (const problem of recyclingProblems) say(`  ${problem}`);
  if (enforcing) process.exit(1);
}
