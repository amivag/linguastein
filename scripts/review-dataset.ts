#!/usr/bin/env tsx
/**
 * Editorial review aid: finds the rows a human should look at, by exception.
 *
 * `validate:data` is the gate — it asks whether the pack is well-formed.
 * This asks something a schema cannot: whether the *content* is right. It is
 * advisory and always exits 0, because most of what it surfaces is a judgment
 * call rather than a defect, and a review aid that blocks CI would be silenced.
 *
 * Sign off what you have checked in `content/es/reviewed.tsv`.
 *
 * Usage: tsx scripts/review-dataset.ts [dataset-root]
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadCatalog, loadPack } from '../src/data/loaders/pack.ts';
import type { DatasetSource } from '../src/data/loaders/source.ts';
import type { ItemId } from '../src/domain/content/ids.ts';
import type { ContentPack, LearningItem } from '../src/domain/content/model.ts';

const root = resolve(process.argv[2] ?? 'public/packs');
const source: DatasetSource = {
  name: root,
  read: (path) => readFile(resolve(root, path), 'utf8'),
};

interface Finding {
  /** What a reviewer would have to decide, used to group the report. */
  readonly check: string;
  readonly detail: string;
  /**
   * Items the finding is about. Once every one of them is signed off, the
   * finding is suppressed: a reviewer who looked and decided the row was right
   * should not be asked again, and a report that never shrinks gets ignored.
   * Empty where a finding spans the whole pack rather than named items.
   */
  readonly items: readonly ItemId[];
}

const REFERENCE = 'en';

/** Definite and indefinite articles, as a gender cue for the noun that follows. */
const ARTICLE_GENDER: Record<string, string> = {
  el: 'masculine',
  los: 'masculine',
  un: 'masculine',
  unos: 'masculine',
  la: 'feminine',
  las: 'feminine',
  una: 'feminine',
  unas: 'feminine',
};

function glossesOf(pack: ContentPack): Map<string, string> {
  const glosses = new Map<string, string>();
  for (const translation of pack.translations) {
    if (translation.lang === REFERENCE) glosses.set(translation.ref, translation.text);
  }
  return glosses;
}

/**
 * Two items that mean the same thing in the reference language.
 *
 * Legitimate in two shapes: a regional pair (`papa`/`patata`), where both sides
 * must be marked or the unmarked one teaches a dialect as universal; and an
 * address pair (tú/usted). Anything else is either redundant content or a gloss
 * that needs to distinguish the two.
 */
function collidingGlosses(pack: ContentPack, glosses: Map<string, string>): Finding[] {
  const groups = new Map<string, LearningItem[]>();
  for (const item of pack.items) {
    const gloss = glosses.get(item.id);
    if (!gloss) continue;
    const key = `${item.type}|${gloss.toLowerCase().trim()}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  const findings: Finding[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const gloss = key.slice(key.indexOf('|') + 1);
    const shown = group
      .map((item) => `${item.text} [${item.regions?.join('+') ?? 'no region'}]`)
      .join('  |  ');

    const unmarked = group.filter((item) => !item.regions?.length);
    const addresses = new Set(group.map((item) => item.address ?? ''));

    if (unmarked.length === 0) continue; // a fully marked regional pair
    if (addresses.size === group.length) continue; // a tú/usted pair

    if (unmarked.length < group.length) {
      findings.push({
        check: 'regional pair with an unmarked side',
        detail:
          `"${gloss}" — ${shown}\n      ` +
          `mark the unmarked side too, or confirm it is the universal word`,
        items: group.map((item) => item.id),
      });
    } else {
      findings.push({
        check: 'two items, one meaning',
        detail:
          `"${gloss}" — ${shown}\n      ` +
          `distinguish the glosses, mark them by region or address, or drop one`,
        items: group.map((item) => item.id),
      });
    }
  }
  return findings;
}

/** An article disagreeing with the gender its noun's lexeme declares. */
function genderDisagreements(pack: ContentPack): Finding[] {
  const gender = new Map<string, string>();
  for (const lexeme of pack.lexemes) {
    if (lexeme.gender) gender.set(lexeme.id, lexeme.gender);
  }

  const findings: Finding[] = [];
  for (const item of pack.items) {
    const tokens = item.tokens ?? [];
    for (const [index, token] of tokens.entries()) {
      const article = ARTICLE_GENDER[(tokens[index - 1]?.text ?? '').toLowerCase()];
      const declared = token.lexeme ? gender.get(token.lexeme) : undefined;
      if (!article || !declared || article === declared) continue;
      findings.push({
        check: 'gender disagreement',
        detail:
          `${item.id} "${item.text}" — ${tokens[index - 1]!.text} ${token.text}: ` +
          `article is ${article}, lexeme is ${declared}`,
        items: [item.id],
      });
    }
  }
  return findings;
}

/**
 * A sentence whose address marking contradicts its own verb.
 *
 * Deliberately narrow. Address is not always carried by the verb: in
 * `Perdón, no te oigo` the verb is first person and `te` does the addressing, and
 * an imperative is tagged person 2 whatever its politeness, with `formality`
 * carrying tú-versus-usted. Comparing person against address in either case
 * reports correct rows as wrong — the same trap as guessing a command from word
 * order. So only an unambiguous second- or third-person contradiction counts.
 */
function addressDisagreements(pack: ContentPack): Finding[] {
  const expected: Record<string, { formality: string; number: string }> = {
    tu: { formality: 'informal', number: 'singular' },
    vosotros: { formality: 'informal', number: 'plural' },
    usted: { formality: 'formal', number: 'singular' },
    ustedes: { formality: 'formal', number: 'plural' },
  };

  const findings: Finding[] = [];
  for (const item of pack.items) {
    const want = item.address ? expected[item.address] : undefined;
    if (!want) continue;

    const finite = (item.tokens ?? []).filter((token) => token.morph?.verbForm === 'finite');
    // One main verb only: a subordinate clause may legitimately differ.
    if (finite.length !== 1) continue;

    const verb = finite[0]!;
    const morph = verb.morph!;
    // A first-person verb says nothing about who is being addressed.
    if (morph.person === 1) continue;
    if (morph.number !== undefined && morph.number !== want.number) {
      findings.push({
        check: 'address disagrees with the verb',
        detail:
          `${item.id} "${item.text}" — marked ${item.address}, ` +
          `but ${verb.text} is ${morph.number}`,
        items: [item.id],
      });
      continue;
    }
    // Where politeness is marked, it is the reliable signal for both moods.
    if (morph.formality !== undefined && morph.formality !== want.formality) {
      findings.push({
        check: 'address disagrees with the verb',
        detail:
          `${item.id} "${item.text}" — marked ${item.address}, ` +
          `but ${verb.text} is tagged ${morph.formality}`,
        items: [item.id],
      });
    }
  }
  return findings;
}

/**
 * Words in a sentence that no lexeme claims: tapping one teaches nothing, so
 * either the word belongs in the sources or the sentence should use one that is.
 *
 * Proper nouns are skipped — `Madrid` needs no dictionary entry. They are
 * recognised by a capital away from the start of the sentence, since unlinked
 * tokens carry no part of speech to test instead.
 */
function unlinkedWords(pack: ContentPack): Finding[] {
  const counts = new Map<string, number>();
  let properNouns = 0;

  for (const item of pack.items) {
    const tokens = (item.tokens ?? []).filter((token) => token.pos !== 'PUNCT');
    for (const [index, token] of tokens.entries()) {
      if (token.lexeme) continue;
      if (index > 0 && token.text[0] === token.text[0]?.toUpperCase()) {
        properNouns += 1;
        continue;
      }
      const word = token.text.toLowerCase();
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  const findings = [...counts.entries()]
    .sort(([, left], [, right]) => right - left)
    .map(([word, count]) => ({
      check: 'word linked to no lexeme',
      detail: `${word} — in ${count} sentence${count === 1 ? '' : 's'}`,
      items: [],
    }));

  if (properNouns > 0) {
    console.log(`  (skipped ${properNouns} unlinked capitalised words as proper nouns)`);
  }
  return findings;
}

const catalog = await loadCatalog(source);
let total = 0;

for (const entry of catalog.packs) {
  const { pack } = await loadPack(source, entry.manifest);
  const glosses = glossesOf(pack);
  const raised = [
    ...collidingGlosses(pack, glosses),
    ...genderDisagreements(pack),
    ...addressDisagreements(pack),
    ...unlinkedWords(pack),
  ];

  const signedOff = new Set(
    pack.items.filter((item) => item.provenance?.review === 'reviewed').map((item) => item.id),
  );
  // A reviewer who looked at these rows and kept them has answered the question.
  const findings = raised.filter(
    (finding) => finding.items.length === 0 || !finding.items.every((id) => signedOff.has(id)),
  );
  total += findings.length;

  console.log(
    `\n${pack.manifest.id} — ${pack.items.length} items, ` +
      `${signedOff.size} signed off in content/es/reviewed.tsv`,
  );
  if (raised.length > findings.length) {
    console.log(`  (${raised.length - findings.length} settled by sign-off)`);
  }

  const byCheck = new Map<string, Finding[]>();
  for (const finding of findings) {
    byCheck.set(finding.check, [...(byCheck.get(finding.check) ?? []), finding]);
  }

  for (const [check, group] of byCheck) {
    console.log(`\n  ${check} (${group.length})`);
    for (const finding of group) console.log(`    - ${finding.detail}`);
  }

  if (findings.length === 0) console.log('\n  Nothing to review by exception.');
}

console.log(
  `\n${total} thing(s) to look at. Advisory: these are judgment calls, not schema errors.`,
);
