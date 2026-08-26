#!/usr/bin/env tsx
/**
 * Builds a content pack from the authoring sources in `content/<language>/`.
 *
 * Authors write compact TSV; this script derives everything mechanical: stable
 * ids, sentence tokenisation, lexeme links, grammar-pattern annotations, the
 * translation records, and — where the language has a module for it — verb
 * paradigms, noun plurals, adjective agreement and numeral spellings.
 *
 * Deriving rather than hand-writing is the point: a human should never type
 * `hablábamos`, and a dataset should never disagree with itself about whether
 * `tengo` belongs to `tener`.
 *
 * Everything language-specific arrives through one seam. `LanguageModule`
 * (`src/languages/types.ts`) is loaded by tag, so the grammar of the language
 * being built is the only grammar in memory, and every capability on it is
 * optional: a language with no module yet builds its sentences and derives
 * nothing, rather than failing inside a conjugator. What is left here is the
 * part that never had an opinion about Spanish — ids, the ledger, topics,
 * skills, passages, review, duplicate text, file naming and manifest assembly.
 *
 * Usage: tsx scripts/build-dataset.ts [language]   (default `es`)
 */

import { readFileSync, mkdirSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CEFR_LEVELS, PASSAGE_KINDS, SKILL_KINDS } from '../src/domain/content/model.ts';
import { sentenceMood } from '../src/domain/content/mood.ts';
import { languageModule } from '../src/languages/index.ts';

/**
 * Which language to build. The tag decides the sources, the pack id, the file
 * names and the module — nothing else selects a language, so there is no way to
 * build `de` from `content/es` or to label a Spanish pack German.
 */
const LANGUAGE = (process.argv[2] ?? 'es').trim().toLowerCase();

// Overridable so a test can build a scratch copy of the sources without
// touching the checked-in pack.
const CONTENT_DIR = resolve(process.env['LINGUASTEIN_CONTENT_DIR'] ?? `content/${LANGUAGE}`);
const PACKS_DIR = resolve(process.env['LINGUASTEIN_PACKS_DIR'] ?? 'public/packs');
const PACK_ID = `core-${LANGUAGE}`;
const OUT_DIR = join(PACKS_DIR, PACK_ID);
const NS = `${PACK_ID}:`;
/** Where the sources are, as the generated files should name them. */
const SOURCE_LABEL = `content/${LANGUAGE}`;

/**
 * The grammar of the language being built, and only that language's.
 *
 * Loaded rather than imported: a static import of `es/conjugation.ts` would put
 * Spanish in memory for a German build, which is the thing the seam exists to
 * prevent and the thing a test can check.
 */
const language = await languageModule(LANGUAGE);

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
  /**
   * `masculine` | `feminine`, for a self-description whose gender the build
   * cannot see. Blank is the normal case: derived where the morphology is
   * unambiguous, and absent everywhere else.
   */
  speakerGender: string;
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
  level: string;
  /**
   * This language's own wording for the capability, where the neutral one is
   * weaker. Empty means the registry's description is the gloss.
   */
  gloss: string;
}

/**
 * One language-neutral capability, from the shared registry.
 *
 * The description and the prerequisite graph live here rather than on the
 * per-language row because they are not facts about a language. See
 * `content/capabilities.tsv` for the derivation.
 */
interface CapabilityRow {
  slug: string;
  description: string;
  prerequisites: string[];
  line: number;
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

/**
 * The capability registry, shared by every language rather than owned by one.
 *
 * A sibling of the language directories — `content/capabilities.tsv` beside
 * `content/es/` — because it belongs to no language, and putting it inside one
 * would make every other language's build read Spanish's content directory.
 * Resolved from `CONTENT_DIR`'s parent so `LINGUASTEIN_CONTENT_DIR` moves both
 * halves together and a fixture can supply its own.
 */
const CAPABILITIES_PATH = join(CONTENT_DIR, '..', 'capabilities.tsv');
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
        speakerGender,
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
        speakerGender: speakerGender ?? '',
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
      const [slug, kind, label, level, gloss] = row.fields;
      return {
        slug: slug!,
        kind: kind!,
        label: label!,
        level: level!,
        gloss: gloss ?? '',
      };
    })
  : [];

/**
 * The shared capability registry, keyed by slug.
 *
 * Read with its own parser rather than through `readSource`, which resolves
 * against `CONTENT_DIR` and strips a leading id column. This file sits outside
 * any language directory and its first column is a slug, so neither behaviour
 * is wanted.
 *
 * Absent is a legitimate state — a language with no authored `function` rows
 * needs no registry — and the gate below is what makes it an error only when
 * something actually referenced it.
 */
const capabilityRows: CapabilityRow[] = existsSync(CAPABILITIES_PATH)
  ? readFileSync(CAPABILITIES_PATH, 'utf8')
      .split(/\r?\n/)
      .flatMap((text, line) => {
        if (text.trim().length === 0 || text.startsWith('#')) return [];
        const [slug, description, prerequisites] = text.split('\t').map((cell) => cell.trim());
        return [
          {
            slug: slug ?? '',
            description: description ?? '',
            prerequisites: list(prerequisites),
            line,
          },
        ];
      })
  : [];

const capabilities = new Map<string, CapabilityRow>(
  capabilityRows.map((capability) => [capability.slug, capability]),
);

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
  /** `YYYY-MM-DD`, authored beside the version. See the guard below for why. */
  updated: string;
}

const packRow: PackRow | undefined = existsSync(join(CONTENT_DIR, PACK_FILE))
  ? (() => {
      const [row] = readSource(PACK_FILE).rows;
      if (!row) return undefined;
      const [version, items, updated] = row.fields;
      return {
        version: version!,
        items: Number(items ?? Number.NaN),
        updated: (updated ?? '').trim(),
      };
    })()
  : undefined;

/**
 * Who made the pack, one row per contributor.
 *
 * A list rather than a single `author`, for the reason `voices.tsv` is a list:
 * content has contributors rather than an owner, they hold different roles, and a
 * generated pack's honest author is a tool rather than a person. Optional, so a
 * pack that has not decided yet simply ships without the field rather than with
 * an invented one.
 */
const AUTHORS_FILE = 'authors.tsv';

interface AuthorRow {
  name: string;
  role: string;
  url: string;
}

/**
 * What the pack calls itself, authored beside the content in `manifest.tsv`.
 *
 * Key–value rather than columns, because these are unrelated single facts that
 * grow one at a time — a fifth column of prose on `pack.tsv`'s version row would
 * put the pack's blurb next to its item count.
 *
 * Every key is optional and falls back to something derived from the tag, so a
 * language builds before anyone has written its description. The fallbacks are
 * deliberately plain: `core-de` rather than an invented "German Core", because a
 * generated name that reads like an authored one is how a placeholder ships.
 */
const MANIFEST_FILE = 'manifest.tsv';

const manifestRows: Map<string, string> = existsSync(join(CONTENT_DIR, MANIFEST_FILE))
  ? new Map(
      readSource(MANIFEST_FILE).rows.flatMap((row) => {
        const [key, value] = row.fields;
        return key ? [[key.trim(), (value ?? '').trim()] as [string, string]] : [];
      }),
    )
  : new Map();

const authored = (key: string): string | undefined => manifestRows.get(key) || undefined;
/** The language the sources' gloss column is written in. */
const GLOSS_LANGUAGE = authored('glossLanguage') ?? 'en';

const authorRows: AuthorRow[] = existsSync(join(CONTENT_DIR, AUTHORS_FILE))
  ? readSource(AUTHORS_FILE).rows.map((row) => {
      const [name, role, url] = row.fields;
      return { name: (name ?? '').trim(), role: (role ?? '').trim(), url: (url ?? '').trim() };
    })
  : [];

// ── guards ──────────────────────────────────────────────────────────────────

const problems: string[] = [];

if (!packRow) {
  problems.push(`${PACK_FILE}: missing — the pack has no version to ship`);
} else if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packRow.version)) {
  problems.push(`${PACK_FILE}: "${packRow.version}" is not a semver version`);
} else if (!Number.isInteger(packRow.items)) {
  problems.push(`${PACK_FILE}: "${packRow.items}" is not an item count`);
}

/*
 * A passage key is what a sentence row joins on, so two rows claiming one key
 * silently merge two texts into one.
 *
 * Worth its own check because the symptom is unrecognisable as the cause: reusing
 * `familia-foto` for a second passage produced *two contradictory* errors — "has
 * a line with no speaker" and "is not a dialogue but names a speaker" — because
 * the merged passage was a dialogue and a text at once. Neither message mentions
 * the duplicate, and both send a reader to inspect sentences that are fine.
 */
const passageKeys = new Map<string, number>();
for (const passage of passageRows) {
  const seen = passageKeys.get(passage.key);
  if (seen !== undefined) {
    problems.push(
      `passages.tsv line ${passage.row.line}: passage key "${passage.key}" is already used on ` +
        `line ${seen} — a sentence joins on this key, so two passages sharing one merge into a ` +
        'single text',
    );
  } else {
    passageKeys.set(passage.key, passage.row.line);
  }
}

/*
 * The release date is authored, and checked rather than trusted.
 *
 * Not stamped from the clock, and that is the whole design: the build has to be
 * reproducible — CI fails when a rebuild changes `public/packs` — so a date read
 * at build time would make every build differ from the last and turn the drift
 * check into noise. Authoring it costs one field on a row a human already has to
 * edit, because the item-count guard forces a visit here whenever content moves.
 *
 * Two things are worth rejecting. A shape that is not `YYYY-MM-DD`, and a day
 * that does not exist — `2026-02-31` matches the pattern and is not a date, so
 * the round trip through `Date` is what actually validates it. A date in the
 * future is rejected too: it means someone typed next month by accident, and a
 * pack that claims to be newer than it is cannot be reasoned about at all.
 */
if (packRow?.updated) {
  const shaped = /^\d{4}-\d{2}-\d{2}$/.test(packRow.updated);
  const parsed = new Date(`${packRow.updated}T00:00:00Z`);
  const real =
    shaped && !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(packRow.updated);
  if (!real) {
    problems.push(`${PACK_FILE}: "${packRow.updated}" is not a real YYYY-MM-DD date`);
  } else if (parsed.getTime() > Date.now()) {
    problems.push(`${PACK_FILE}: "${packRow.updated}" is in the future`);
  }
} else if (packRow) {
  problems.push(
    `${PACK_FILE}: no updated date — add one as YYYY-MM-DD in the third column, ` +
      'so a learner can see how old the pack they installed is',
  );
}

for (const author of authorRows) {
  if (!author.name) {
    problems.push(`${AUTHORS_FILE}: a row with no name`);
  }
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

const KEBAB_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The registry's own integrity, checked before anything is asked of it.
 *
 * These are language-independent failures, so they are worth catching once here
 * rather than once per language that happens to reference the broken row.
 */
for (const capability of capabilityRows) {
  const where = `capabilities.tsv line ${capability.line + 1}`;
  if (!KEBAB_SLUG.test(capability.slug)) {
    problems.push(`${where}: "${capability.slug}" is not a stable kebab-case slug`);
  }
  if (capability.description.length === 0) {
    problems.push(`${where}: "${capability.slug}" has no description`);
  }
  for (const prerequisite of capability.prerequisites) {
    if (!capabilities.has(prerequisite)) {
      problems.push(`${where}: "${capability.slug}" requires unknown capability "${prerequisite}"`);
    }
  }
}

for (const duplicate of capabilityRows
  .map((capability) => capability.slug)
  .filter((slug, index, all) => all.indexOf(slug) !== index)) {
  problems.push(`capabilities.tsv: "${duplicate}" is registered more than once`);
}

const authoredSkillSlugs = new Set(authoredSkillRows.map((skill) => skill.slug));
for (const skill of authoredSkillRows) {
  if (!(SKILL_KINDS as readonly string[]).includes(skill.kind)) {
    problems.push(`${SKILLS_FILE}: "${skill.slug}" has unknown kind "${skill.kind}"`);
  }
  if (!KEBAB_SLUG.test(skill.slug)) {
    problems.push(`${SKILLS_FILE}: "${skill.slug}" is not a stable kebab-case slug`);
  }
  if (skill.kind !== 'function') continue;

  // A function is a capability this language spells, so the capability has to
  // exist first. This is the gate that stops a second direction inventing its
  // own curriculum vocabulary and then diverging from it silently.
  const capability = capabilities.get(skill.slug);
  if (!capability) {
    problems.push(
      `${SKILLS_FILE}: "${skill.slug}" is a function with no entry in capabilities.tsv — ` +
        `add it there (it is shared with every language) or fix the typo`,
    );
    continue;
  }

  // An override that restates the shared description is how the per-language
  // file quietly becomes the source again: the next author copies the pattern,
  // and within a few rows the registry is decoration. So it has to differ.
  if (skill.gloss.length > 0 && skill.gloss === capability.description) {
    problems.push(
      `${SKILLS_FILE}: "${skill.slug}" overrides its description with the same text ` +
        `capabilities.tsv already gives — drop the column and share the default`,
    );
  }

  // A prerequisite comes from the registry, so it can name a capability this
  // language has not authored yet. That is a curriculum hole rather than a typo,
  // and it has to be loud: the emitted record would otherwise carry a
  // prerequisite pointing at a skill id this pack does not contain.
  for (const prerequisite of capability.prerequisites) {
    if (!authoredSkillSlugs.has(prerequisite)) {
      problems.push(
        `${SKILLS_FILE}: "${skill.slug}" needs "${prerequisite}", which capabilities.tsv ` +
          `requires but this language does not cover — author it or drop the dependency`,
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

/*
 * A declared speaker gender is checked rather than trusted: it is the escape
 * hatch for the cases the morphology cannot show, so a typo in it would fail
 * silently — the column would simply do nothing, and the sentence would go on
 * being offered to everyone.
 */
for (const sentence of sentences.filter((entry) => entry.speakerGender)) {
  if (!['masculine', 'feminine'].includes(sentence.speakerGender)) {
    problems.push(
      `${sentence.source} (${sentence.text}): speaker gender "${sentence.speakerGender}" is not masculine or feminine`,
    );
  } else if (sentence.passage) {
    problems.push(
      `${sentence.source} (${sentence.text}): a passage line is spoken by a character, so it cannot declare the learner's gender`,
    );
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
/*
 * A row that says it is a letter has to be a letter `alphabet.ts` names.
 *
 * The same guard as the numerals one below, for the same failure: `hache` and
 * `ache` are both plausible to type and only one is the letter. Checked against
 * the module rather than a list, so the pack and the `spellWord` a drill would
 * read from cannot disagree about what a letter is called.
 *
 * Keyed on the **gloss**, not the topic. The topic was the obvious signal and
 * the wrong one: `alfabeto`, `vocal` and `acento` are all squarely about the
 * alphabet and none of them is a letter, so filing by topic rejected three
 * correct rows the first time this ran. What identifies the claim is the row
 * saying "the letter X".
 *
 * One direction only. Not every letter has a row — the five vowels are named
 * after themselves and would collide head-on with `a`, `e`, `o` and `u` as
 * ordinary words, and `de`, `te`, `ve` and `ese` would each ambush a far more
 * common word in the surface index. Those are taught in sentences instead, so
 * "every letter name has a card" is deliberately not the rule.
 */
const CLAIMS_LETTER = /^the letter /i;
for (const noun of nouns) {
  if (!CLAIMS_LETTER.test(noun.gloss)) continue;
  if (language.alphabet && !language.alphabet.isLetterName(noun.lemma)) {
    problems.push(
      `${noun.lemma}: glossed as a letter, but the language module names no letter that — ` +
        'check the spelling against the module',
    );
  }
}

const numeralValues = new Map<string, number>();

/*
 * Only a language whose module spells numbers can be told it has spelled one
 * wrong. Without this guard the gate reads every `NUM` row of a module-less
 * language as unreadable and fails the build on content that is fine.
 */
const numerals = language.numerals;

for (const modifier of numerals ? modifiers : []) {
  if (modifier.pos !== 'NUM') continue;

  const value = numerals!.parseCardinal(modifier.lemma);
  if (value === null) {
    problems.push(
      `${modifier.lemma}: tagged NUM but the language module cannot read it — check the accent`,
    );
    continue;
  }
  const canonical = numerals!.spellCardinal(value);
  if (canonical !== modifier.lemma) {
    problems.push(
      `${modifier.lemma}: the language module spells ${value} as "${canonical}" — use that spelling`,
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

for (const modifier of numerals ? modifiers : []) {
  if (modifier.pos !== 'ADJ') continue;

  const value = numerals!.parseOrdinal(modifier.lemma);
  if (value === null) continue;

  const canonical = numerals!.spellOrdinal(value);
  if (canonical !== modifier.lemma) {
    problems.push(
      `${modifier.lemma}: the language module spells the ${value}th as "${canonical}" — use that spelling`,
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

/*
 * A closed class's agreement is the module's, so the sources may not restate it.
 *
 * The same rule the ordinals get above, and for the same reason: `estas` and
 * `las` were typed into the extra-surfaces column, and a hand-typed agreement is
 * a spelling that can disagree with the one the app derives. What stays declared
 * is what no rule produces — `algún` and `ningún`, which are apocopations rather
 * than agreements, exactly as `buen` stays declared beside derived `buena`.
 */
for (const modifier of language.nominals?.closedClassForms ? modifiers : []) {
  const derived = new Set(
    language.nominals!.closedClassForms!(modifier.lemma).map((entry) => entry.form.toLowerCase()),
  );
  if (derived.size === 0) continue;
  const restated = modifier.forms.filter((form) => derived.has(form.toLowerCase()));
  if (restated.length > 0) {
    problems.push(
      `${modifier.lemma}: the language module already derives ${restated.join(', ')} — ` +
        'drop them from the extra surfaces column',
    );
  }
}

/*
 * The `regularity` column and the module's own table have to agree, and only a
 * module that has a table can be asked. A verb declared irregular with no entry
 * ships `teno` for `tengo`; one declared regular *with* an entry means the column
 * is lying about something the module already knows.
 */
if (language.verbs) {
  for (const verb of verbs) {
    const declared = verb.regularity === 'irregular';
    const known = language.verbs.isDeclaredIrregular(verb.lemma);
    if (declared && !known) {
      problems.push(`${verb.lemma}: declared irregular but the language module does not list it`);
    }
    if (!declared && known) {
      problems.push(
        `${verb.lemma}: declared regular but the language module lists it as irregular`,
      );
    }
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
/**
 * Which lemmas claimed each stem, in claim order. The order is the load-bearing
 * part: it decides which lemma gets the bare id and which gets the suffixed one.
 */
const stemClaims = new Map<string, string[]>();
const lexemeProblems: string[] = [];

/**
 * The id for a lemma in a part of speech, and the gate that stops two different
 * words sharing one.
 *
 * The disambiguation below is right for Spanish and hides a bug in every
 * language whose alphabet `slug` cannot spell. `slug` ends by replacing
 * everything outside `[a-z0-9]`, so it answers `""` for every Greek and Chinese
 * lemma, and folds German umlauts into their bare vowels — `schön` to `schon`,
 * `fördern` to `fordern`, `Bär` to `bar`. Appending the part of speech absorbs
 * exactly those collisions without a word of complaint: `schön` is an adjective
 * and `schon` an adverb, so the second ships as `lexeme:schon-adj`, a distinct
 * id named after a different word. That is the `eñe`/`ene` bug this file already
 * fixed once, waiting in A1 German vocabulary.
 *
 * The two cases are only distinguishable by the lemma, which is why the claims
 * are recorded here rather than beside the form ids: `mañana` the noun and
 * `mañana` the adverb are the *same* word twice and the suffix is the right
 * answer; two different lemmas wanting one stem is a missing transliteration
 * (`docs/tasks/language-matrix.md` §1). `stem-collisions.tsv` is where that
 * difference is declared — see {@link checkStemCollisions}.
 */
function lexemeId(lemma: string, pos: string): string {
  const key = `${lemma}|${pos}`;
  const existing = lexemeIds.get(key);
  if (existing) return existing;

  const stem = slug(lemma);
  // Never recordable: with an empty stem *every* lexeme in the language collides,
  // so there is no pair to declare and nothing the suffix can rescue.
  if (stem.length === 0) {
    lexemeProblems.push(
      `"${lemma}": slug is empty, so every lexeme in this alphabet would share one id — ` +
        `the language module owes a transliteration`,
    );
  } else {
    const claims = stemClaims.get(stem);
    if (claims === undefined) stemClaims.set(stem, [lemma]);
    else if (!claims.includes(lemma)) claims.push(lemma);
  }

  const base = `${NS}lexeme:${stem}`;
  // Two lexemes may share a lemma (`mañana` the noun and the adverb); the part
  // of speech disambiguates the id rather than an arbitrary number.
  const id = takenIds.has(base) ? `${base}-${pos.toLowerCase()}` : base;
  // One suffix, so the third claimant on a stem gets an id the second already
  // holds. Spanish never reaches three; an alphabet `slug` cannot spell reaches
  // it on the third word, and would have shipped two lexemes as one.
  if (takenIds.has(id)) {
    lexemeProblems.push(`"${lemma}" (${pos}) wants ${id}, which another lexeme already holds`);
  }
  takenIds.add(id);
  lexemeIds.set(key, id);
  return id;
}

/**
 * The stem a form id is built on: the lexeme's own id, minus its namespace.
 *
 * Not `slug(lemma)` a second time, which is what this replaced. `slug` folds a
 * combining tilde away, so `eñe` and `ene` produce one stem — and where
 * `lexemeId` notices a collision and disambiguates, the form ids had no such
 * guard and simply issued `core-es:form:ene-n-sg` twice. The second silently
 * won, which for a letter card meant the pack shipped the plural of `ene`
 * standing in for the plural of `eñe`.
 *
 * Deriving from the lexeme id means uniqueness is established once, where it is
 * already handled, instead of twice with one of the two unwatched. For every
 * lemma that does not collide the stem is character-for-character what `slug`
 * gave, so existing form ids are unchanged.
 */
function formStem(lexeme: string): string {
  return lexeme.slice(lexeme.lastIndexOf(':') + 1);
}

/**
 * A lemma as an id fragment: lowercase, ASCII, hyphen-separated.
 *
 * `ñ` is handled before the accents come off, and becomes `nn` rather than
 * `n`. The strip below cannot tell a tilde from an acute, so folding it away
 * made `año` into `ano` — a different word entirely — and collided the letter
 * name `eñe` with `ene`, which is how one letter's plural shipped under the
 * other's form id. Nineteen lemmas carry an `ñ`; all of them are now distinct
 * from their tilde-less near-twins, including the pairs no content has reached
 * yet (`caña`/`cana`, `peña`/`pena`).
 */
function slug(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[ñÑ]/g, 'nn')
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

/**
 * Stem collisions the pack has accepted, and the gate that stops a new one.
 *
 * A ratchet rather than an error, for the reason the recycling ratchet is one:
 * `content/es` already has eight, all `tilde diacrítica` pairs where the accent
 * *is* the difference between two words — `el`/`él`, `si`/`sí`, `que`/`qué` —
 * and their ids are permanent. Failing on those would block every other kind of
 * work behind a rename nobody can safely do. So the file records where we are,
 * and the build refuses to let it get worse.
 *
 * Two things it protects that nothing did before.
 *
 * A **new** language's collisions fail on the first build rather than shipping:
 * German's `schon`/`schön` and `fordern`/`fördern` are the same accident with no
 * history behind them, and the fix is the transliteration, not an entry here.
 *
 * And the **order** is pinned. Which lemma gets the bare `lexeme:te` and which
 * gets `lexeme:te-pron` depends only on which source file is read first — so
 * moving `té` from `nouns.tsv` today silently swaps two lexeme ids, and mastery
 * is keyed on those. Item ids have `id-ledger.tsv` to stop exactly this; lexeme
 * ids had nothing. Recording the claim order is that guard.
 */
function checkStemCollisions(): void {
  const file = 'stem-collisions.tsv';
  const recorded = new Map<string, string>();
  if (existsSync(join(CONTENT_DIR, file))) {
    for (const row of readRows(file)) {
      const [stem, lemmas] = row.fields;
      if (stem) recorded.set(stem, lemmas ?? '');
    }
  }

  const found = new Map([...stemClaims].filter(([, lemmas]) => lemmas.length > 1));

  for (const [stem, lemmas] of found) {
    const claim = lemmas.join(',');
    const known = recorded.get(stem);
    if (known === undefined) {
      lexemeProblems.push(
        `${lemmas.map((lemma) => `"${lemma}"`).join(' and ')} all slug to "${stem}", ` +
          `so one takes an id naming the other — give the language a transliteration, ` +
          `or record the pair in ${file} if the accent is the whole difference`,
      );
    } else if (known !== claim) {
      lexemeProblems.push(
        `${file}: "${stem}" is recorded as ${known} but is now claimed by ${claim} — ` +
          `the ids these lemmas get have swapped`,
      );
    }
  }

  // The other half of a ratchet: an improvement that goes unrecorded is how the
  // ceiling goes stale in the direction that costs nothing to ignore.
  for (const stem of recorded.keys()) {
    if (!found.has(stem)) {
      lexemeProblems.push(`${file}: "${stem}" no longer collides — drop the row`);
    }
  }
}

// Every lexeme the pack declares has now been minted; the `lexemeId` calls below
// are lookups of these same keys. So this is the first point where the whole set
// is known, and reporting together is what lets an author fix a language's
// transliteration in one pass rather than one build per word.
checkStemCollisions();
if (lexemeProblems.length > 0) {
  console.error('Lexeme id problems:\n  ' + lexemeProblems.join('\n  '));
  process.exit(1);
}

// ── verb forms ──────────────────────────────────────────────────────────────

interface FormRecord {
  id: string;
  lexeme: string;
  form: string;
  /*
   * Open rather than `Morphology`, and deliberately. These records are also the
   * surface index's entries, and that index carries morphs read off source rows
   * as plain strings — a gender column, a number — which the model's unions
   * cannot describe without validating every row first. The typed inventory is
   * enforced one level up, on `GeneratedForm`, which is where a generator could
   * actually invent a key; here it is widened once, at the seam, rather than
   * cast at five call sites.
   */
  morph: Record<string, unknown>;
  level: string;
  regions?: readonly string[];
}

// A language with no conjugator emits no verb forms, rather than being handed a
// stub whose empty result looks like a verb with no paradigm.
const verbForms: FormRecord[] = language.verbs
  ? verbs.flatMap((verb) => {
      const lexeme = lexemeId(verb.lemma, 'VERB');
      return language.verbs!.conjugate(verb.lemma).map((generated) => ({
        id: `${NS}form:${formStem(lexeme)}-${formSuffix(generated.morph)}`,
        lexeme,
        form: generated.form,
        morph: { ...generated.morph },
        level: generated.level ?? verb.level,
        ...(generated.regions ? { regions: generated.regions } : {}),
      }));
    })
  : [];

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
  // Every tense needs a distinct abbreviation here: two tenses falling through to
  // `x` would give one verb two forms with the same id, and the second would win.
  const tense =
    { present: 'pres', preterite: 'pret', imperfect: 'imp', future: 'fut', conditional: 'cond' }[
      morph.tense ?? ''
    ] ?? 'x';
  // Mood belongs in the key for exactly the same reason, and the subjunctive is
  // what proved it: it carries `tense: 'present'`, so keying on tense alone
  // hands `hablo` and `hable` the same `hablar-pres-1s` and the second wins
  // silently. Only the marked moods are spelled — the indicative is the
  // unmarked case, and prefixing it would rename every id already issued.
  const mood = morph.mood === 'subjunctive' ? 'subj-' : '';
  return `${mood}${tense}-${morph.person}${plural ? 'p' : 's'}`;
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
 * The language module has generated these since the pack existed,
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
  /**
   * Any part of speech a nominal paradigm can belong to. It was `'NOUN' | 'ADJ'`
   * while those were the only two generators; the closed classes brought `DET`,
   * `PRON` and the quantifying `ADV`, and narrowing it to a union of five would
   * only have to be widened again by the next language.
   */
  pos: string;
}

/*
 * A declared plural needs no module; a derived one does. So a language whose
 * module has no `pluralOf` still ships the singular and the irregulars its
 * sources declare, and simply has no derived plurals — which is the honest
 * state of a language nobody has written morphology for, and reads as one.
 */
const pluralOf = language.nominals?.pluralOf;
const adjectiveForms = language.nominals?.adjectiveForms;
const closedClassForms = language.nominals?.closedClassForms;

/**
 * The paradigm of a closed-class row, as records rather than as index entries.
 *
 * `este`, `el`, `su` and `cuánto` had their surfaces typed into the
 * extra-surfaces column and indexed, so a sentence linked them and nothing else
 * could see them: `formsOf` returned an empty list, which is what word
 * inspection reads to show a paradigm and what the cloze reads for its
 * alternatives. Emitting them keeps both honest, and costs no content — every
 * one of these was already in the file.
 *
 * `-c-` in the id rather than `-a-`: an article is not an adjective, and the two
 * generators must not be able to mint the same id for different words. The form
 * id gate below is what would catch it if they did — and it can now.
 */
function closedClassRecords(modifier: ModifierRow): NominalForm[] {
  const forms = closedClassForms?.(modifier.lemma) ?? [];
  if (forms.length === 0) return [];
  const lexeme = lexemeId(modifier.lemma, modifier.pos);
  const key = formStem(lexeme);
  return forms.map((entry) => ({
    id: `${NS}form:${key}-c-${entry.morph.gender?.[0] ?? 'x'}${entry.morph.number === 'plural' ? 'pl' : 'sg'}`,
    lexeme,
    lemma: modifier.lemma,
    pos: modifier.pos,
    form: entry.form,
    morph: { ...entry.morph },
    level: modifier.level,
  }));
}

const nominalForms: NominalForm[] = [
  ...nouns.flatMap((noun): NominalForm[] => {
    const lexeme = lexemeId(noun.lemma, 'NOUN');
    const gender = noun.gender === 'f' ? 'feminine' : 'masculine';
    const key = formStem(lexeme);
    // A form of `papa` is as regional as the lexeme: the plural of a word a
    // learner should not be taught is not a word either.
    const regions = noun.regions.length > 0 ? { regions: noun.regions } : {};
    // An irregular plural is declared (examen → exámenes, and the invariable
    // lunes); everything else is derived.
    const plural = noun.plural || pluralOf?.(noun.lemma);
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
      ...(plural
        ? [
            {
              id: `${NS}form:${key}-n-pl`,
              lexeme,
              lemma: noun.lemma,
              pos: 'NOUN' as const,
              form: plural,
              morph: { gender, number: 'plural' },
              level: noun.level,
              ...regions,
            },
          ]
        : []),
    ];
  }),
  ...modifiers.flatMap(closedClassRecords),
  ...(adjectiveForms ? modifiers.filter((modifier) => modifier.pos === 'ADJ') : []).flatMap(
    (modifier): NominalForm[] => {
      const lexeme = lexemeId(modifier.lemma, 'ADJ');
      const key = formStem(lexeme);
      return adjectiveForms!(modifier.lemma).map((entry) => ({
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
    },
  ),
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
 * No two forms may share an id, and this is checked rather than trusted.
 *
 * `formSuffix` already carries a comment about the collision it exists to
 * prevent, which is exactly the sort of care that stops one class of duplicate
 * and leaves the rest unwatched: the ids also depend on the *stem*, and a stem
 * built by folding accents away collided `eñe` with `ene` and shipped one
 * letter's plural under the other's id. Nothing failed, because nothing looked.
 */
const formProblems: string[] = [];
const formIds = new Map<string, string>();
for (const form of [...verbForms, ...packedNominalForms]) {
  const seen = formIds.get(form.id);
  if (seen !== undefined && seen !== form.form) {
    formProblems.push(
      `form id "${form.id}" is claimed by both "${seen}" and "${form.form}" — one would ` +
        'silently overwrite the other in the pack',
    );
  }
  formIds.set(form.id, form.form);
}

/*
 * Its own list and its own gate, as the id, lexeme and passage checks each have.
 *
 * This pushed onto `problems`, which is reported and exited on hundreds of lines
 * *above* here — so a form-id collision was collected into a list nobody read
 * again and the build went on to ship the pack. The check whose comment says it
 * exists because "nothing failed, because nothing looked" was itself not looked
 * at. Every other check after that gate already owns a list for exactly this
 * reason; this one was the exception.
 */
if (formProblems.length > 0) {
  console.error('Form id problems:\n  ' + formProblems.join('\n  '));
  process.exit(1);
}

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
  // Skipped where a paradigm already indexed it — an adjective's, and now a
  // closed class's. A second entry for one surface is not harmless: `disambiguate`
  // compares `subjunctive.length` against `candidates.length`, so a duplicate
  // could tip a decision that was never about it.
  const inflects = modifier.pos === 'ADJ' || (closedClassForms?.(modifier.lemma).length ?? 0) > 0;
  const citation = inflects ? [] : [{ form: modifier.lemma, morph: {} }];
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
  const shortened = numerals!.spellOrdinal(value, { beforeNoun: true });
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
 * The words that put the verb straight after them in the subjunctive.
 *
 * `que` carries most of the language's triggers on its own — `quiero que`,
 * `es importante que`, `para que`, `antes de que`, `aunque` — so the rest of
 * this set is only the words that trigger the mood by themselves. `no` is here
 * for the negative command: `no entres` is the subjunctive and `no entras` is a
 * statement.
 */
const SUBJUNCTIVE_TRIGGERS = new Set(['que', 'ojalá', 'quizá', 'quizás', 'cuando', 'no', 'aunque']);

/**
 * Picks between lexemes that share a surface form. `trabajo` is the noun in
 * "el trabajo" and the verb in "trabajo en una oficina"; the words around it
 * decide. When the cues are missing or several candidates survive, the token is
 * left unlinked — a wrong lemma is worse than a missing one.
 */
function disambiguate(
  before: readonly Token[],
  candidates: SurfaceEntry[],
  next: string | undefined,
): SurfaceEntry | null {
  if (candidates.length === 0) return null;
  const previous = before.at(-1);

  /*
   * A subjunctive reading needs a trigger; without one, the ordinary word wins.
   *
   * `entre` is the preposition in `entre las dos` and the present subjunctive of
   * `entrar` in `que entre`. Generating the subjunctive turned the first into an
   * ambiguity it had never been, and the preposition lost every sentence it had:
   * `ADP` appears in neither `preferred` set below, so nothing could rescue it
   * and it went unlinked wherever it occurred.
   *
   * The rule is the one the `present-subjunctive` skill is glossed with, which
   * is why it is trustworthy rather than a patch — the mood does not appear on
   * its own. The trigger has to be the word immediately before, deliberately:
   * scanning further left would read `Creo que entre las dos hay tiempo` as a
   * subjunctive because a `que` appears somewhere earlier in it.
   */
  const subjunctive = candidates.filter((entry) => entry.morph?.['mood'] === 'subjunctive');
  // Only where a *second lexeme* is in play. Where every candidate is the same
  // verb, there is no ordinary word to protect and the alternative reading is
  // that verb's own usted command — which is indexed whenever nothing else
  // claims the surface. Dropping the subjunctive there picked `salga` out of
  // `Ojalá que todo salga bien` as a command addressed to somebody, and the
  // sentence went out labelled usted with nobody in it.
  const contested = new Set(candidates.map((entry) => entry.lexeme)).size > 1;
  if (contested && subjunctive.length > 0 && subjunctive.length < candidates.length) {
    const triggered =
      previous !== undefined && SUBJUNCTIVE_TRIGGERS.has(previous.text.toLowerCase());
    candidates = triggered
      ? subjunctive
      : candidates.filter((entry) => entry.morph?.['mood'] !== 'subjunctive');
  }

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

/**
 * Pronouns that attach to the end of a verb, longest first so `nos` is tried
 * before `os` and `melo` before `lo`.
 *
 * Spanish sticks the object onto an infinitive, a gerund or an affirmative
 * command — `ayudarme`, `ayudándome`, `dígame` — and the whole thing is written
 * as one word. `tokenise` is per-word, so every one of them arrived with no
 * lexeme: the largest group of unlinked tokens in the pack, and the one a learner
 * is most likely to tap, because `ayudarme` is exactly the word they do not know.
 */
const ENCLITICS = [
  'melo',
  'mela',
  'selo',
  'sela',
  'telo',
  'tela',
  'noslo',
  'nosla',
  'los',
  'las',
  'les',
  'nos',
  'me',
  'te',
  'se',
  'lo',
  'la',
  'le',
  'os',
] as const;

/**
 * Every verb form a pronoun can actually attach to, by surface.
 *
 * Infinitives, gerunds and commands only. A finite tense cannot take an enclitic,
 * so `cantaba` + `la` is not a reading this can invent — which is most of what
 * keeps the strip from turning ordinary words into verbs.
 */
const attachableForms = new Map<string, SurfaceEntry[]>();
for (const form of verbForms) {
  const lemma = verbLemmaOf.get(form.lexeme);
  if (!lemma) continue;
  const morph = form.morph;
  const attachable =
    morph['verbForm'] === 'infinitive' ||
    morph['verbForm'] === 'gerund' ||
    morph['mood'] === 'imperative';
  if (!attachable) continue;
  const key = form.form.toLowerCase();
  const entry: SurfaceEntry = { lexeme: form.lexeme, lemma, pos: 'VERB', morph };
  const existing = attachableForms.get(key);
  if (existing) existing.push(entry);
  else attachableForms.set(key, [entry]);
}
for (const verb of verbs) {
  const key = verb.lemma.toLowerCase();
  const entry: SurfaceEntry = {
    lexeme: lexemeId(verb.lemma, 'VERB'),
    lemma: verb.lemma,
    pos: 'VERB',
    morph: { verbForm: 'infinitive' },
  };
  const existing = attachableForms.get(key);
  if (existing) existing.push(entry);
  else attachableForms.set(key, [entry]);
}

/** `díga` → `diga`: the accent an enclitic adds, taken back off. */
function withoutAccent(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');
}

/**
 * Resolves `ayudarme` to `ayudar`, `dígame` to `diga`, `verte` to `ver`.
 *
 * Only ever tried when **nothing** claims the surface as it stands, which is what
 * keeps it safe: a noun that merely looks like a verb plus a pronoun — `tomate`
 * ending in `te` over the command `toma` — is claimed by its own lexeme first and
 * never reaches here. Where the pack does not hold such a noun the strip could
 * still mislead, so the stem has to be a form a pronoun can actually attach to:
 * an infinitive, a gerund, or a command. A finite tense cannot take one, so
 * `cantaba` + `la` is not a reading this will invent.
 *
 * The accent is why `AGENTS.md` calls this morphology rather than a suffix trim.
 * `diga` becomes `dígame` because Spanish moves the stress mark when the word
 * grows, so stripping the pronoun leaves `díga`, which is not a form of anything.
 * Taking the accent back off is the second half of the rule.
 */
function resolveEnclitic(surface: string): SurfaceEntry | undefined {
  const lower = surface.toLowerCase();

  for (const enclitic of ENCLITICS) {
    if (!lower.endsWith(enclitic) || lower.length <= enclitic.length + 1) continue;
    const stem = lower.slice(0, -enclitic.length);

    for (const candidate of [stem, withoutAccent(stem)]) {
      /*
       * Searched against the generated forms rather than the surface index, and
       * that is the difference between `dime` linking and not.
       *
       * Commands are indexed only where no other lexeme already claims the
       * surface, so `decir`'s `di` lost that race to `dar`'s preterite `di` and is
       * absent from the index entirely. At the enclitic level there is no contest
       * to lose: `dame` is dar and `dime` is decir, different words. So the strip
       * asks the paradigm, where both forms exist, and applies its own ambiguity
       * rule to what it finds.
       */
      const attachable = attachableForms.get(candidate) ?? [];
      // One lexeme or none: two different verbs claiming the stem is the same
      // ambiguity `disambiguate` declines to guess at, and for the same reason.
      const lexemes = new Set(attachable.map((entry) => entry.lexeme));
      if (lexemes.size === 1) return attachable[0]!;
    }
  }

  return undefined;
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
    // The enclitic reading is a last resort, tried only when nothing claims the
    // surface as written — see `resolveEnclitic` for why that ordering is what
    // makes it safe rather than merely convenient.
    const entry =
      disambiguate(tokens, candidates, matches[position + 1]) ??
      (candidates.length === 0 ? resolveEnclitic(surface) : undefined);
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

/**
 * Object and reflexive pronouns as they appear *before* a finite verb.
 *
 * The same pronouns as {@link ENCLITICS}, and a separate list on purpose: these
 * are whole words (`no te preocupes`) where those are a suffix inside one
 * (`preocúpate`). Spanish puts them in front of a finite verb and sticks them
 * onto an infinitive, a gerund or an affirmative command, so a shared list would
 * have to be filtered by position at every use anyway.
 */
const PROCLITICS = new Set(['me', 'te', 'se', 'nos', 'os', 'lo', 'la', 'le', 'los', 'las', 'les']);

/**
 * The demonstratives, determiners and neuter pronouns alike.
 *
 * Lemmas rather than surfaces: the build indexes `esta`, `estos` and `estas`
 * against `este`, so one entry covers the paradigm and a new surface needs no
 * change here. Named in the build the way `tener`, `ir` and the proclitics are —
 * this is the language's closed class, not something content declares. Contrast
 * `INTERROGATIVES`, which *is* read off a topic, because which words ask a
 * question is a set a human curates and this one has three members and a
 * grammar.
 */
const DEMONSTRATIVES = new Set(['este', 'ese', 'aquel', 'esto', 'eso']);

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
      // `os` was the one member of the paradigm missing here, and it went unnoticed
      // because no sentence used it — see `docs/tasks/function-words.md` §4.2.
      if (!['me', 'te', 'le', 'nos', 'os', 'les'].includes(pronoun.text.toLowerCase())) return null;
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
    /*
     * The negative command, which is the subjunctive wearing a different hat.
     *
     * Worth its own skill rather than folding into `present-subjunctive`,
     * because it is the one place the mood is not optional-feeling: a learner
     * who says `no habla` has said "he does not speak", not "do not speak". The
     * affirmative and the negative use different forms — `habla` but
     * `no hables` — and nothing about `habla` hints at that.
     *
     * Not emitted as extra `forms` records, deliberately. A negative command is
     * these exact strings with `no` in front, so a `no hables` form would put a
     * two-word surface into an index of words and give `hables` two records
     * differing only in a label. The `ordinals` pattern settles the same
     * question the same way: index the form once, teach the use as a pattern.
     */
    skill: `${NS}skill:negative-command`,
    label: 'no hables',
    gloss: 'a negative command uses the subjunctive, not the command form: habla but no hables',
    level: 'b1',
    match: (tokens, i) => {
      if (!isWord(tokens[i], 'no')) return null;
      /*
       * A command is a main clause, and `no` + subjunctive is not enough to be
       * one. `Ojalá no llueva mañana` and `Espero que no vengas` have the same
       * two words in the same order and neither orders anybody about — the first
       * shipped tagged as a command before this check existed.
       *
       * So the `no` has to open the utterance, or a clause of it: nothing but
       * punctuation before it, or a comma immediately before, which keeps
       * `Por favor, no hables tan rápido` while rejecting both of those.
       */
      const before = tokens.slice(0, i);
      const priorWord = before.filter((token) => token.pos !== 'PUNCT').at(-1);
      const opensClause = priorWord === undefined || tokens[i - 1]?.text === ',';
      if (!opensClause) return null;

      // `No te preocupes`, `No se lo digas`: the pronouns sit in between, and
      // before a finite verb they are written as separate words.
      let end = i + 1;
      while (PROCLITICS.has(tokens[end]?.text.toLowerCase() ?? '')) end += 1;
      const verb = tokens[end];
      if (!verb || verb.pos === 'PUNCT') return null;
      if (verb.morph?.['mood'] !== 'subjunctive') return null;
      return tokens.slice(i, end + 1).map((token) => token.id);
    },
  },
  {
    /*
     * The three-way distance contrast, and the agreement that carries it.
     *
     * `docs/tasks/function-words.md` asks for this and the reason is in its §2:
     * the header of `sentences-questions.tsv` says the choosing dialogue exists
     * to teach `este`/`ese`/`aquel`, and nothing in the pack named what it was
     * teaching. A hundred-odd sentences carry a demonstrative and a learner met
     * every one of them unlabelled.
     *
     * Matched on every demonstrative rather than only where two of them appear
     * together, which is the `ordinals` precedent and right for the same reason:
     * the contrast is what the *gloss* teaches, and a skill that fired only on
     * sentences comparing two would attach to almost nothing while the ordinary
     * use went on being unnamed.
     *
     * The neuter pair is in the set. `esto` and `eso` are the forms with no noun
     * to agree with — `¿Qué es esto?` — and they are separate lexemes in the
     * content rather than surfaces of the determiners, so nothing else would
     * reach them.
     */
    skill: `${NS}skill:demonstratives`,
    label: 'este, ese, aquel',
    gloss:
      'Spanish points three distances where English points two: este here, ese there, aquel over there — and each agrees with its noun (esta casa, estos días), or takes the neuter esto/eso when there is no noun to agree with',
    level: 'a1',
    match: (tokens, i) => {
      const token = tokens[i];
      if (!token || token.lemma === undefined) return null;
      if (token.pos !== 'DET' && token.pos !== 'PRON') return null;
      return DEMONSTRATIVES.has(token.lemma) ? [token.id] : null;
    },
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
  future: {
    id: `${NS}skill:future`,
    label: 'futuro simple',
    gloss: 'the future tense, built on the whole infinitive',
    level: 'a2',
  },
  conditional: {
    id: `${NS}skill:conditional`,
    label: 'condicional simple',
    gloss: 'would — the same stem as the future, with the imperfect endings',
    level: 'a2',
  },
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
 * The subjunctive, which is a mood and so sits here rather than in TENSE_SKILLS.
 *
 * The gloss names what *triggers* it rather than what it "means", because the
 * mood has no meaning a learner can use: `sea` is not a different time or a
 * different degree of certainty on its own. It appears because something in
 * front of it put it there — a wish, a doubt, an emotion, a `para que`. Saying
 * "the subjunctive expresses unreality" is the explanation that leaves an
 * English speaker unable to produce a single sentence.
 *
 * The one form a learner already knows is worth the reminder: they have been
 * saying `siga` and `dígame` since A1, and those are this paradigm. So this is
 * less a new tense than a name for something two thirds met already.
 */
const SUBJUNCTIVE_SKILL = {
  id: `${NS}skill:present-subjunctive`,
  label: 'presente de subjuntivo',
  gloss:
    'the form a trigger asks for — querer que, es importante que, para que, ojalá — and the same form as a usted command',
  level: 'b1',
};

/**
 * Every grammar skill the build derives, named once.
 *
 * This list used to be spelled out twice — once to emit the skill records and
 * once to build the gloss map — with the same four sources in both. Adding a
 * fifth to one and not the other gives either a skill with no gloss or a gloss
 * for a skill that is never emitted, and neither fails the build. The
 * subjunctive was the fifth.
 */
const GRAMMAR_SKILLS = [
  ...Object.values(TENSE_SKILLS),
  IMPERATIVE_SKILL,
  SUBJUNCTIVE_SKILL,
  ...Object.values(QUESTION_SKILLS),
];

/**
 * The numeral rules as practisable skills, read off the language module.
 *
 * The table of labels used to sit here, typed `Record<NumeralRule, …>` so a rule
 * added to `numerals.ts` without a label failed the typecheck. It moved beside
 * the rules it names (`src/languages/es/index.ts`), which keeps that guarantee —
 * the record is still exhaustive over the module's own rule union — and stops
 * this file holding one language's grammar prose.
 */
const numeralSkills = numerals?.skills ?? [];

const numeralSkillId = (rule: string): string => `${NS}skill:numerals-${rule}`;

const usedSkills = new Set<string>();

/** Lexeme id → the regions that word belongs to, for propagating onto phrases. */
const nounRegions = new Map<string, string[]>(
  nouns
    .filter((noun) => noun.regions.length > 0)
    .map((noun) => [lexemeId(noun.lemma, 'NOUN'), noun.regions]),
);

/**
 * Every regional claim on one sentence, narrowed to the region that satisfies
 * them all — or `null` where they contradict each other.
 *
 * The **intersection**, not the union, and the comment at the call site was
 * already saying so: a word's regions are a *limit*, and two limits on one
 * sentence are both true at once. Unioning them widened instead, so a sentence
 * declared `es-419` that reached for a Spain-only noun came out claiming both —
 * and a learner filtering Browse to `es-419` would be shown wording that is not
 * theirs, which is the one thing the field exists to prevent.
 *
 * An empty intersection is not a narrower answer, it is a contradiction, and the
 * honest response is to refuse rather than to pick. Returning `[]` would mean
 * "used everywhere", which is the opposite of what two disjoint claims say, and
 * `regionConflicts` fails the build on it: two regionalisms from regions that do
 * not overlap is a sentence no learner should be taught, in any region.
 *
 * Overlapping-but-unequal claims are the ordinary case and simply narrow —
 * `vosotros` (es-ES) beside `nevera` (es-ES and the Caribbean) is an es-ES
 * sentence, which is what `os` makes it.
 */
function narrowRegions(claims: readonly (readonly string[])[]): string[] | null {
  if (claims.length === 0) return [];
  let narrowed = [...new Set(claims[0]!)];
  for (const claim of claims.slice(1)) {
    const allowed = new Set(claim);
    narrowed = narrowed.filter((region) => allowed.has(region));
    if (narrowed.length === 0) return null;
  }
  return narrowed;
}

const regionConflicts: string[] = [];

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
 * Verbs that put the speaker's own gender into the sentence.
 *
 * A copula, and only a copula: `Soy alta` describes the speaker, while `Tengo
 * una hermana` describes somebody else with a feminine noun. Reflexive
 * `sentirse` earns its place because `Me siento cansada` is the same shape.
 */
const SELF_DESCRIBING_VERBS = new Set(['ser', 'estar', 'sentir']);

/** Words that may sit between the copula and its predicate. */
const PREDICATE_SKIP = new Set(['ADV', 'DET']);

/**
 * Whether this surface form can *only* be first-person singular.
 *
 * The reason this check exists at all: the linker resolves an ambiguous form to
 * the first entry it indexed, so `estaba` in `El comedor estaba vacío` carries
 * `person: 1` — it is the imperfect, where first and third person are spelled
 * the same. Trusting that would file a sentence about a dining room as a
 * masculine learner's self-description, and then hide it from everybody else.
 *
 * So the form is asked of the index rather than of the token: if any other
 * person produces this same spelling in the same tense and mood, the sentence
 * says nothing reliable about who is speaking.
 */
function onlyFirstPersonSingular(token: Token): boolean {
  const morph = token.morph as Record<string, unknown> | undefined;
  if (!morph || morph['person'] !== 1 || morph['number'] !== 'singular') return false;

  return !(surfaces.get(token.text.toLowerCase()) ?? []).some((entry) => {
    if (entry.pos !== 'VERB' || entry.lemma !== token.lemma) return false;
    const other = entry.morph as Record<string, unknown> | undefined;
    if (!other || other['person'] === 1) return false;
    return other['tense'] === morph['tense'] && other['mood'] === morph['mood'];
  });
}

/**
 * The gender a sentence commits its speaker to, or `''` for the usual case
 * where it commits them to nothing.
 *
 * Adjectives only, and that restriction is doing real work. `Soy una persona
 * tranquila` agrees with `persona`, which is feminine whoever says it, so a rule
 * that accepted the first gendered *noun* after the copula would hide that
 * sentence from every man learning Spanish. Stopping at a noun costs the
 * professions — `Soy profesora` is a genuine self-description the build cannot
 * see — and those are declared in the column instead. A missed one is content
 * shown to everybody, which is what it does today; a wrong one is content
 * silently taken away.
 */
function deriveSpeakerGender(tokens: readonly Token[]): string {
  for (const [position, token] of tokens.entries()) {
    if (token.pos !== 'VERB' || !token.lemma) continue;
    if (!SELF_DESCRIBING_VERBS.has(token.lemma)) continue;
    if (!onlyFirstPersonSingular(token)) continue;

    for (const next of tokens.slice(position + 1)) {
      if (PREDICATE_SKIP.has(next.pos ?? '')) continue;
      if (next.pos !== 'ADJ') break;
      const gender = (next.morph as Record<string, unknown> | undefined)?.['gender'];
      if (gender === 'masculine' || gender === 'feminine') return gender;
      break;
    }
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

  /*
   * Any finite non-command reading is a candidate, not the indicative alone.
   *
   * This asked for `indicative` while the third person present was the only
   * thing an usted command could be mistaken for. The subjunctive changed that:
   * `gire` is `girar`'s usted command *and* its subjunctive, and the subjunctive
   * is now indexed while the command is not, so the opening token arrived
   * subjunctive and this returned early — `Gire a la derecha.` went back to
   * being read as a statement, which is the exact bug the function exists for.
   */
  const opening = tokens.find((token) => token.pos !== 'PUNCT');
  const mood = opening?.morph?.['mood'];
  if (!opening?.lexeme || opening.morph?.['verbForm'] !== 'finite') return;
  if (mood !== 'indicative' && mood !== 'subjunctive') return;

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
    const mood = token.morph?.['mood'];
    // Mood is asked first, and the tense skill only applies to the indicative.
    // A subjunctive `hable` carries `tense: 'present'`, so without this guard
    // every subjunctive sentence would be filed under `presente de indicativo`
    // — teaching the learner the one thing the form is not.
    if (mood === 'subjunctive') {
      skills.add(SUBJUNCTIVE_SKILL.id);
      usedSkills.add(SUBJUNCTIVE_SKILL.id);
    } else if (typeof tense === 'string' && TENSE_SKILLS[tense]) {
      skills.add(TENSE_SKILLS[tense]!.id);
      usedSkills.add(TENSE_SKILLS[tense]!.id);
    }
    if (mood === 'imperative') {
      skills.add(IMPERATIVE_SKILL.id);
      usedSkills.add(IMPERATIVE_SKILL.id);
    }
  }

  const lexemes = [...new Set(tokens.map((token) => token.lexeme).filter(Boolean))] as string[];
  const hasFiniteVerb = tokens.some((token) => token.morph?.['verbForm'] === 'finite');
  const address = sentence.address || deriveAddress(tokens);
  /*
   * A line inside a passage is spoken by a *character*, so its gender is the
   * character's and narrowing it by the learner's would delete a line from the
   * middle of a text somebody is reading. Only sentences that stand alone are
   * ever the learner's own words.
   */
  const speakerGender = sentence.passage
    ? ''
    : sentence.speakerGender || deriveSpeakerGender(tokens);
  // A sentence inherits the regional limits of the words it uses: a phrase
  // built on `papa` is not one a learner in Spain should be taught unmarked.
  const claims: readonly (readonly string[])[] = [
    ...(sentence.regions.length > 0 ? [sentence.regions] : []),
    ...lexemes.flatMap((id) => {
      const declared = nounRegions.get(id);
      return declared ? [declared] : [];
    }),
    ...(() => {
      const byAddress = language.regionsForAddress?.(address ?? '') ?? [];
      return byAddress.length > 0 ? [byAddress] : [];
    })(),
  ];
  const regions = narrowRegions(claims);
  if (regions === null) {
    regionConflicts.push(
      `${sentence.text} — regional claims that share no region: ` +
        claims.map((claim) => claim.join('+')).join(' vs '),
    );
  }

  return {
    id: itemId(sentence.row),
    pack: PACK_ID,
    type: hasFiniteVerb ? 'sentence' : 'phrase',
    text: sentence.text,
    level: sentence.level,
    ...(sentence.register ? { register: sentence.register } : {}),
    ...(address ? { address } : {}),
    ...(speakerGender ? { speakerGender } : {}),
    ...(regions !== null && regions.length > 0 ? { regions } : {}),
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

if (regionConflicts.length > 0) {
  console.error(
    'Regional conflicts — each of these sentences mixes wording from regions that do not\n' +
      'overlap, so there is no learner it is right for. Replace the offending word:\n  ' +
      regionConflicts.join('\n  '),
  );
  process.exit(1);
}

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
  ...GRAMMAR_SKILLS.map((skill) => ({
    id: skill.id,
    kind: 'grammar',
    label: skill.label,
    level: skill.level,
  })),
].filter((skill) => usedSkills.has(skill.id));

/**
 * The prerequisite graph, read from the shared registry and namespaced into this
 * pack.
 *
 * The graph is a fact about the capability rather than about the language, so it
 * is not restated per language — but the *ids* are this pack's, because
 * `core-es:skill:order-food-drink` and `core-en:skill:order-food-drink` are two
 * things to be good at. The gate above has already established that every
 * prerequisite names a capability this language covers.
 */
const capabilityPrerequisites = (slug: string): string[] =>
  (capabilities.get(slug)?.prerequisites ?? []).map(authoredSkillId);

const authoredSkillRecords: SkillRecord[] = authoredSkillRows
  .map((skill) => {
    const prerequisites = skill.kind === 'function' ? capabilityPrerequisites(skill.slug) : [];
    return {
      id: authoredSkillId(skill.slug),
      kind: skill.kind,
      label: skill.label,
      level: skill.level,
      ...(prerequisites.length ? { prerequisites } : {}),
    };
  })
  .filter((skill) => usedSkills.has(skill.id));

// Numeral skills are declared rather than discovered. Every other skill here
// is emitted only if an item uses it, but the numeral drill's targets are
// generated on demand — 1042 exists in no pack — so nothing would ever mark
// these used, and the attempts the drill records need them to exist.
const numeralSkillRecords: SkillRecord[] = numeralSkills.map((skill) => ({
  id: numeralSkillId(skill.rule),
  kind: 'pattern',
  label: skill.label,
  level: skill.level,
}));

const skillRecords: SkillRecord[] = [
  ...derivedSkillRecords,
  ...authoredSkillRecords,
  ...numeralSkillRecords,
];

const skillGlosses = new Map<string, string>([
  ...PATTERNS.map((pattern) => [pattern.skill, pattern.gloss] as const),
  ...GRAMMAR_SKILLS.map((skill) => [skill.id, skill.gloss] as const),
  // A function's description is the registry's, so it is written once and every
  // language glosses the same sentence. Any other authored kind has no
  // description to gloss — patterns and grammar skills are generated, and their
  // glosses come from the two tables above.
  ...capabilityRows.map(
    (capability) => [authoredSkillId(capability.slug), capability.description] as const,
  ),
  // …and this language's override last, so it wins the `Map` constructor.
  ...authoredSkillRows
    .filter((skill) => skill.gloss.length > 0)
    .map((skill) => [authoredSkillId(skill.slug), skill.gloss] as const),
  ...numeralSkills.map((skill) => [numeralSkillId(skill.rule), skill.gloss] as const),
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
    lang: GLOSS_LANGUAGE,
    text: sentence.translation,
    type: 'natural',
    ...(sentence.note ? { note: sentence.note } : {}),
  })),
  ...vocabularySources.map((entry, position) => ({
    ref: vocabularyItems[position]!.id,
    lang: GLOSS_LANGUAGE,
    text: glossOf(entry.lemma, entry.pos),
    type: 'natural',
  })),
  // Word-level meanings: what a learner sees when tapping a word in a phrase.
  ...verbs.map((verb) => ({
    ref: lexemeId(verb.lemma, 'VERB'),
    lang: GLOSS_LANGUAGE,
    text: verb.gloss,
  })),
  ...nouns.map((noun) => ({
    ref: lexemeId(noun.lemma, 'NOUN'),
    lang: GLOSS_LANGUAGE,
    text: noun.gloss,
  })),
  ...modifiers.map((modifier) => ({
    ref: lexemeId(modifier.lemma, modifier.pos),
    lang: GLOSS_LANGUAGE,
    // Same decoration as the card: tapping `treinta` in a sentence should show
    // "(30)" too, and this is the only gloss the 22 uncarded numerals ever get.
    text: glossOf(modifier.lemma, modifier.pos),
  })),
  ...skillRecords.map((skill) => ({
    ref: skill.id,
    lang: GLOSS_LANGUAGE,
    text: skillGlosses.get(skill.id) ?? skill.label,
  })),
  // A passage title is target-language text like any other, so its reference
  // translation is a separate record rather than a field.
  ...passageRows
    .filter((passage) => passage.titleTranslation)
    .map((passage) => ({
      ref: passageEntityId(passage.row),
      lang: GLOSS_LANGUAGE,
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

/**
 * The levels the pack actually holds, in CEFR order, and the label built from
 * them.
 *
 * Both used to be literals — `levels: ['a1', 'a2']` and the name `Spanish Core
 * A1–A2` — which is the same shape of bug as the pack version written once in
 * this script and left there while the content quadrupled. `courseOptions`
 * derives a course's levels from the items, so the picker would have grown a B1
 * entry on its own; the *manifest* would have gone on claiming A1–A2, and
 * Settings reads the manifest. So the pack would have advertised a scope it no
 * longer had, to the one screen whose job is describing the pack.
 *
 * Derived from the emitted items rather than from the source rows, so a level
 * that is authored but filtered out before shipping is not advertised.
 */
const presentLevels = CEFR_LEVELS.filter((level) =>
  [...sentenceItems, ...vocabularyItems].some((item) => item.level === level),
);

const levelSpan = (levels: readonly string[]): string => {
  const first = levels[0]?.toUpperCase();
  const last = levels[levels.length - 1]?.toUpperCase();
  if (!first) return '';
  return first === last ? first : `${first}–${last}`;
};

/**
 * The file-name prefix, derived from the levels rather than typed.
 *
 * `es-a1-a2-core` was spelled by hand into ten paths below. The convention in
 * `docs/dataset-format.md` is that a file name states its level range, so the
 * day B1 content landed all ten stated something false — and a name is exactly
 * the kind of thing nobody re-reads once it looks right. Deriving it from the
 * same `presentLevels` the manifest uses means the range cannot lag the content,
 * and a single-level pack gets `es-a1-core` rather than `es-a1-a1-core`.
 *
 * Renaming these files on a level change is intended, not a side effect: the
 * loader reads paths out of `pack.json`, which is written in the same pass, so
 * the two cannot disagree.
 */
const filePrefix = ((levels: readonly string[]) => {
  const first = levels[0] ?? 'a1';
  const last = levels[levels.length - 1] ?? first;
  return first === last ? `${LANGUAGE}-${first}-core` : `${LANGUAGE}-${first}-${last}-core`;
})(presentLevels);

// ── write ───────────────────────────────────────────────────────────────────

/** The languages the translation records are actually in, in first-seen order. */
const translationLanguages = [...new Set(translations.map((record) => record.lang))];

const files = [
  { kind: 'skills', path: `${filePrefix}-skills.jsonl`, records: skillRecords },
  { kind: 'lexemes', path: `${filePrefix}-verbs.jsonl`, records: clean(verbLexemes) },
  { kind: 'lexemes', path: `${filePrefix}-nouns.jsonl`, records: clean(nounLexemes) },
  { kind: 'lexemes', path: `${filePrefix}-modifiers.jsonl`, records: clean(modifierLexemes) },
  {
    kind: 'forms',
    path: `${filePrefix}-forms.jsonl`,
    records: [...verbForms, ...packedNominalForms],
  },
  { kind: 'items', path: `${filePrefix}-vocabulary.jsonl`, records: vocabularyItems },
  { kind: 'items', path: `${filePrefix}-sentences.jsonl`, records: sentenceItems },
  { kind: 'passages', path: `${filePrefix}-passages.jsonl`, records: passageRecords },
  // One file per language the records are in, so a second reference language
  // is a file beside this one rather than a change to it. See
  // `docs/tasks/language-matrix.md` §3.
  ...translationLanguages.map((lang) => ({
    kind: 'translations',
    path: `${filePrefix}-translations-${lang}.jsonl`,
    records: translations.filter((record) => record.lang === lang),
  })),
  ...audioLocales.map((locale) => ({
    kind: 'audio',
    path: `${filePrefix}-audio-${locale}.jsonl`,
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
  const header = `# Generated by scripts/build-dataset.ts from ${SOURCE_LABEL} — do not edit by hand.\n`;
  const body = file.records.map((record) => JSON.stringify(record)).join('\n');
  writeFileSync(join(OUT_DIR, file.path), `${header}${body}\n`, 'utf8');
}

const manifest = {
  id: PACK_ID,
  name: `${authored('name') ?? PACK_ID} ${levelSpan(presentLevels)}`.trim(),
  targetLanguage: LANGUAGE,
  // Authored in `pack.tsv`, beside the content it describes.
  version: packRow?.version ?? '0.0.0',
  ...(packRow?.updated ? { updated: packRow.updated } : {}),
  ...(authorRows.length > 0
    ? {
        authors: authorRows.map((author) => ({
          name: author.name,
          ...(author.role ? { role: author.role } : {}),
          ...(author.url ? { url: author.url } : {}),
        })),
      }
    : {}),
  description:
    authored('description') ??
    `Generated from ${SOURCE_LABEL} and not yet reviewed by a human editor.`,
  license: authored('license') ?? 'CC0-1.0',
  levels: presentLevels,
  // Derived rather than authored: this says what the pack can explain itself
  // in, and the translation files it ships are the only honest answer.
  referenceLanguages: translationLanguages,
  pronunciationLocales: (authored('pronunciationLocales') ?? LANGUAGE)
    .split(',')
    .map((locale) => locale.trim())
    .filter(Boolean),
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
  provenance: {
    source: 'generated',
    origin: SOURCE_LABEL,
    review: 'unreviewed',
    revision: 1,
  },
  files: files.map((file) => ({ kind: file.kind, path: file.path })),
};

writeFileSync(join(OUT_DIR, 'pack.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

/*
 * Delete the `.jsonl` files this build did not write.
 *
 * The build appends to a directory rather than replacing it, which was harmless
 * while every file had a hand-typed name that never changed. Deriving the level
 * range from the content made the names move — the first B1 sentence renamed all
 * nine — and the old set stayed on disk beside the new one: nine stale files
 * that `globPatterns` would precache into every learner's service worker, for a
 * pack nothing references.
 *
 * Scoped to `.jsonl` so `pack.json` and anything a human put here survives, and
 * driven from `files` rather than from a name pattern, so this also catches a
 * file that stops being emitted because its content went away.
 */
const written = new Set(files.map((file) => file.path));
const stale = readdirSync(OUT_DIR).filter((name) => name.endsWith('.jsonl') && !written.has(name));
for (const name of stale) rmSync(join(OUT_DIR, name));

/*
 * The catalog lists every pack in the output directory, not the one just built.
 *
 * It was a literal naming `core-es`, which was correct while there was one
 * pack and silently wrong the moment there were two: `build:data de` would
 * have written a catalog listing only German, and every Spanish course would
 * have vanished from the app on the next deploy without a single file being
 * deleted. Reading the directory means each language is built independently
 * and the catalog is whatever is actually there.
 *
 * Sorted so the file does not churn on directory order, and filtered to
 * directories that really hold a manifest, so a half-deleted pack or a stray
 * folder cannot make the app fetch a 404 on startup.
 */
const catalogued = readdirSync(PACKS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(PACKS_DIR, entry.name, 'pack.json')))
  .map((entry) => entry.name)
  .sort();

writeFileSync(
  join(PACKS_DIR, 'catalog.json'),
  `${JSON.stringify(
    {
      $comment: 'Packs shipped with this build. Generated by scripts/build-dataset.ts.',
      packs: catalogued.map((id) => ({ id, manifest: `${id}/pack.json` })),
    },
    null,
    2,
  )}\n`,
  'utf8',
);

// ── coverage report ─────────────────────────────────────────────────────────

const allLexemes = [...verbLexemes, ...nounLexemes, ...modifierLexemes];

/*
 * The lexemes that are letter cards, by id rather than by name.
 *
 * Matching on the lemma alone looked equivalent and was not: `isLetterName`
 * answers true for `a`, `o`, `de`, `te` and `ese`, which in this pack are a
 * preposition, a conjunction, another preposition, a pronoun and a demonstrative
 * — five of the most common A1 words there are. Exempting *those* from the
 * recycling target silently dropped the A1 population by five and made the
 * ratchet report an improvement nobody had earned.
 */
const letterCardLexemes = new Set(
  nouns
    .filter((noun) => noun.topics.includes('alphabet'))
    .map((noun) => lexemeId(noun.lemma, 'NOUN')),
);
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
    ` (${numeralSkills.length} numeral rules, declared rather than discovered)`,
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
const RECYCLING_FILE = 'recycling.tsv';

/*
 * No file means no ratchet, the same way no audio ledger means no audio. A
 * language nobody has set encounter targets for should build; inventing a
 * default target would fail every new pack on its first sentence, and a required
 * file whose only sane initial content is "no rows" is a step, not a gate.
 */
const recyclingRows = (
  existsSync(join(CONTENT_DIR, RECYCLING_FILE)) ? readRows(RECYCLING_FILE) : []
).map((row) => {
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
  /*
   * Numerals are counted apart, the same way the coverage report above counts
   * them apart, and for the same reason: they are a *generated* system rather
   * than vocabulary met in reading. `spellCardinal` composes any number, so 1042
   * is askable while existing in no sentence at all, and the numeral drill is how
   * a learner meets `novecientos` — not by finding it in four different texts.
   *
   * Measured rather than assumed: closing the eight hundreds against a target of
   * four would take twenty-four more sentences, every one of them a variation on
   * "X cost N hundred euros". That is padding, and padding a recycling target is
   * how the target stops meaning anything. They still get sentences — they now
   * have one each, in a passage about what a trip cost — they are simply not held
   * to a threshold designed for words you learn by rereading.
   *
   * The letter names are exempt on the same argument, and it is the same
   * argument rather than a second favour: `jota`, `equis` and `eñe` are a closed
   * generated set that a learner drills as a set and recognises on sight. Six
   * sentences apiece would be a hundred and eight sentences whose only job is to
   * contain a letter name, which is the padding the paragraph above refuses.
   */
  const atLevel = allLexemes.filter(
    (lexeme) =>
      lexeme.level === rule.level && lexeme.pos !== 'NUM' && !letterCardLexemes.has(lexeme.id),
  );
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
