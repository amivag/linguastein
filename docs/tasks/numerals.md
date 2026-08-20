# Task: numbers as a system, not as vocabulary

**Status:** in progress — §3 (the module) has landed, fully covered. §4–§6
remain: number cards, pattern records, the exercise generator and the drill.
**Written:** 2026-08-20
**Revised:** 2026-08-20 — `src/languages/es/numerals.ts` exists and is tested at
100%. §3.2 is new: it records what building it turned up, including one rule the
brief did not know about.
**For:** a fresh agent session, no prior context assumed
**Scope:** a new language module, a bounded set of number cards, a numeral
exercise generator, and pattern records. The learning engine, the scheduler and
the TTS seam are done and should not need changing.

---

## 1. Orientation

Read these first, in order:

1. [`AGENTS.md`](../../AGENTS.md) — the architecture rules; the Datasets and
   The learning model sections are the two this task is constrained by
2. [`src/languages/es/conjugation.ts`](../../src/languages/es/conjugation.ts) —
   **the model to copy.** Its header states the principle this task extends:
   ~100 verbs by ~20 forms is 2,000 chances to misplace an accent, so forms are
   generated from auditable rules rather than typed
3. [`src/languages/es/irregulars.ts`](../../src/languages/es/irregulars.ts) — how
   an exception table is declared and cross-checked by the build
4. [`docs/dataset-format.md`](../dataset-format.md) — record shapes, and what a
   `skill` record is
5. [`docs/tasks/dataset-expansion.md`](dataset-expansion.md) §4 — why an item id
   is permanent, which is the constraint §4 below has to work around

Then run `npm run check`. It must pass before you start.

**The task in one line:** `spellCardinal(1042)` gives `mil cuarenta y dos`, in a
pure module, and then two ways to practise it — a bounded set of cards for the
number words worth memorising, and an unbounded drill for the rules.

---

## 2. Why this is not a dataset job

The obvious implementation is rows in a TSV. It is wrong, for the same reason
hand-typed conjugations are wrong, only more so:

- **You cannot author the set.** A learner's real question is "how do I say
  1042?", and there is no row count that answers it. A thousand rows covers a
  rounding error of what a four-digit number can be.
- **The value is in the rules, not the strings.** What a learner needs is that
  `y` joins tens to units but never hundreds to tens (`treinta y uno`, but
  `ciento uno`); that 16–19 and 21–29 are written solid, with an accent on
  `dieciséis`, `veintidós`, `veintitrés` and `veintiséis` but not on
  `diecisiete` or `veinticuatro`; that `uno` apocopates before a masculine noun
  (`veintiún libros`); that hundreds agree (`doscientas casas`); that `cien`
  becomes `ciento` only in compounds, and `cien mil` is never `ciento mil`; that
  a thousand is `mil` and never `un mil`, while a million is `un millón` and
  takes `de` before a noun. A handful of rules generates every number under a
  billion. No table of numbers teaches one of them.
- **The dataset has an honesty problem here already.** `numbers` is the thinnest
  topic in the shipped pack — 2 items — and `uno` through `mil` sit in
  [`modifiers.tsv`](../../content/es/modifiers.tsv) as `NUM` lexemes with no id,
  so they contribute a lexeme and no word card. Numbers are not practisable
  today. Adding forty rows would make that look solved without solving it.

So: rules in `src/languages/es/`, exactly where verb forms already live.

---

## 3. The module

`src/languages/es/numerals.ts`. Pure TypeScript, no React, no DOM — the same bar
as `conjugation.ts`, and usable at both dataset build time and runtime.

The shape to aim for:

```ts
/** 1042 gives "mil cuarenta y dos". Cardinals below 1,000,000,000. */
export function spellCardinal(n: number, agreement?: Agreement): string;

/** 1 gives "primero" / "primer" / "primera". Ordinals a beginner meets. */
export function spellOrdinal(n: number, agreement?: Agreement): string;

/** Which rules a given number exercises — drives the pattern records in §5. */
export function rulesFor(n: number): readonly NumeralRule[];
```

`Agreement` carries gender and whether the numeral sits directly before a noun,
because that is what decides `veintiún` against `veintiuno` and `doscientas`
against `doscientos`. Default to the standalone form.

`rulesFor` is the piece that makes this practisable rather than merely correct.
It is what lets a drill say _why_ a number was hard, and what lets an attempt
count towards a durable pattern rather than towards one arbitrary integer.

Keep the irreducible tables small and obviously exhaustive, so they can be read
rather than trusted: 0–15, the tens, the hundreds (`quinientos`, `setecientos`
and `novecientos` are the irregular three), and the scale words. Everything else
composes.

### 3.1 Decide the boundaries deliberately

These are in or out on purpose, not by accident. Recommended:

| Thing                                                       | Call       |
| ----------------------------------------------------------- | ---------- |
| Cardinals 0 – 999,999,999                                   | in         |
| Ordinals 1st – 20th, plus apocopating `primer` and `tercer`  | in         |
| Agreement (gender, pre-noun apocopation)                    | in         |
| The clock (`la una`, `las dos y cuarto`, `menos diez`)       | own module |
| Dates (`el uno de enero`, and `el primero de` where used)    | own module |
| Decimals (`dos coma cinco`) and percentages                  | later      |
| Phone numbers read in pairs                                  | later      |

The clock and dates are number-_adjacent_, and are what a learner asks about
next, but they are a different system with their own irregularities — and Latin
America's `el primero de enero` against Spain's `el uno de enero` is a regional
pair, which means the both-sides rule in `AGENTS.md` applies to it. Give them
`time-expressions.ts`, not a branch inside `spellCardinal`.

### 3.2 What building it turned up

Three things worth knowing before touching the module, two of which the brief
above did not anticipate:

- **`mil` and `millón` do not agree the same way, and the reason is that one is a
  noun.** `millón` is, so a numeral in front of it agrees with *it*:
  `doscientos millones de casas`, never `doscientas`. `mil` is not, so a numeral
  reaches straight through it to whatever is being counted:
  `doscientas mil personas`. The composer carries an internal `multiplier` flag
  for exactly this, and `un millón doscientas mil personas` is the case that
  needs both behaviours in one number. Do not "simplify" the two into one path.
- **`de` after a million depends on whether the number stops there.**
  `un millón de personas`, but `un millón doscientas mil personas` with no `de`,
  because the noun attaches to the lower part instead. Gated on `beforeNoun`.
- **Ordinals ship 1–20 using `undécimo` and `duodécimo`**, RAE's first forms, in
  preference to the equally accepted `décimo primero` / `décimo segundo`. The
  choice is recorded here so nobody "corrects" it in either direction; the module
  generates one spelling rather than choosing at runtime. `decimotercer`
  apocopates like the `tercero` it contains.

Four bugs were found by the tests rather than by reading, which is the argument
for keeping the exhaustive pass in §10: `veintiun` without its accent (dropping
the syllable moves the stress onto the `u`), `doscientoas` from trimming one
letter instead of two, `quinientos` left masculine because it ends in `-ientos`
and not `-cientos`, and `veintiún mil` reported as exercising no apocopation rule
because the whole number ends in three zeros — the rule lives in the group, not
in the number.

---

## 4. Two ways to practise, because of one constraint

Architecture rule 4: progress references stable ids. You cannot mint an id per
integer, so a drill over an unbounded set has nowhere to record an attempt. That
forces a split, and the split turns out to be pedagogically right anyway.

### 4.1 Bounded: number cards with real ids

The number words worth memorising _as words_ are a small closed set: 0–20, the
tens, the hundreds, `mil`, `millón`. Give those rows ids in `modifiers.tsv` — the
mechanism already exists, it is just that the `NUM` rows were left without one —
and they become word cards, scheduled like anything else.

Two collisions to expect, both already anticipated by existing conventions:

- **`segundo`** is already a noun card (`500206`, "second" the time unit). The
  ordinal `segundo` would duplicate its text, and the build forbids that. Use the
  `-` id convention: one card, and the other sense stays inspectable when tapped.
- **`uno` and `un`** are already separate rows (`NUM` and `DET`). Keep them that
  way. They are genuinely different words, and merging them would hide the
  apocopation rule the drill is trying to teach.

### 4.2 Unbounded: the drill

Generated targets, so 1042 is askable without existing anywhere. Two options,
and the choice matters:

- **`mode: 'study'`** — records nothing. Honest and free, and consistent with the
  existing rule that a self-rated reveal is not evidence of retrieval. But a
  learner who drills numbers for a week has nothing to show for it.
- **Scored against a pattern id** — an attempt on 1042 counts towards
  `core-es:skill:numerals-y-joining` and `core-es:skill:numerals-mil-millon`, per
  `rulesFor(1042)`. The set of ids is closed and stable, so rule 4 holds; the
  scheduler sees a handful of durable skills rather than an infinity of integers;
  and mastery is already derived from item history rather than stored, so it needs
  no new storage shape.

**Recommendation: the second.** It is the only one that makes the feature feel
like progress, and it is the reason `rulesFor` exists. Fall back to the first
only if the pattern-attempt plumbing turns out to need changes to
`domain/progress` that this task should not be making — and if so, write down
what those changes were, so the next pass starts from the finding rather than
rediscovering it.

---

## 5. Pattern records to add

`skills.jsonl` already carries twelve `kind: "pattern"` records (`tener que +
infinitivo`, `estar + gerundio`, and so on), so this needs no new record kind:

| id                            | label                      | level |
| ----------------------------- | -------------------------- | ----- |
| `numerals-teens`              | dieciséis, diecisiete…     | a1    |
| `numerals-twenties`           | veintiuno, veintidós…      | a1    |
| `numerals-y-joining`          | treinta y uno / ciento uno | a1    |
| `numerals-apocopation`        | veintiún libros            | a2    |
| `numerals-hundreds-agreement` | doscientas casas           | a2    |
| `numerals-cien-ciento`        | cien mil / ciento treinta  | a2    |
| `numerals-mil-millon`         | mil / un millón de         | a2    |

Derive them from the same rule enum `rulesFor` returns, so a rule cannot exist in
the module without a record to practise it against, or the reverse. The build
should fail on a mismatch — the same relationship `irregulars.ts` has with the
`irregular` tag today.

---

## 6. Exercises are derived, never stored

Rule 2. A numeral exercise is generated in
[`domain/exercises/generators.ts`](../../src/domain/exercises/generators.ts) like
every other kind, and nothing numeral-shaped goes into a content record.

Three kinds, in descending order of how much they prove:

- **digits to spoken Spanish** (production). `1042`, and the learner says or
  types `mil cuarenta y dos`. The hardest and the most useful.
- **audio to digits** (listening). Hear `ciento treinta y seis`, type `136`. This
  is the one that exposes whether a learner actually parses numbers in speech,
  and it is the real-world failure: prices, platforms, room numbers and phone
  numbers said at speed.
- **spelled Spanish to digits** (recognition). Cheap, and the weakest, per the
  existing note that recognition is the most flattering mode. First encounters
  only.

Number ranges should widen as the pattern stabilises rather than being a fixed
difficulty: two digits, then three, then four, then the awkward ones — anything
needing a `veintiún`, anything with a zero in the middle, anything crossing a
hundreds boundary.

---

## 7. Pronunciation

The TTS seam speaks text. **Expand the numeral to words before it reaches the
seam** — never hand `"1042"` to a voice and hope. What an engine does with digits
varies by engine and locale, and the whole point of the module is that the app
knows the answer rather than delegating it.

One intersection with [`canonical-audio.md`](canonical-audio.md): a clip is keyed
by a hash of the spoken text, so the bounded cards in §4.1 can have canonical
audio like anything else, but the drill's generated targets cannot — there is no
finite set to generate clips for. The drill uses device TTS on generated text,
and the existing behaviour applies unchanged: a language with no matching voice
gets silence plus an explanation, which is deliberate.

---

## 8. Rules and constraints

- **Never hand-type a numeral.** The same rule as conjugation, and the reason
  this task exists. A test asserting a hard-coded `mil cuarenta y dos` is fine; a
  _table_ of hand-typed numerals inside the module is the failure mode.
- **The domain stays language-agnostic.** `src/languages/es/` is where Spanish
  lives. `domain/exercises` may ask "spell this number in the target language"
  through a seam; it may not know about `y`, `cien`, or accents.
- **Accents are load-bearing.** `dieciséis` and `veintidós` are wrong without
  them. Test the accented forms explicitly, and test the ones that _lack_ an
  accent so a blanket rule cannot pass.
- **Coverage floors apply, and `src/languages` is held high.** This is a pure
  module and cheap to test exhaustively: assert a spelled form for every integer
  0–1000 against a checked-in snapshot, then spot-check the boundaries above it.
  Do not lower a floor to fit.
- **Progress references stable ids only.** Whatever §4.2 lands on, no attempt may
  reference an id that does not exist in a pack file.
- **Provenance stays honest.** New cards ship `review: unreviewed` like the rest.
  Generated numerals are correct by construction, which is not the same as
  reviewed, and that distinction is the whole point of the field.

---

## 9. Definition of done

- [x] `numerals.ts` spells every cardinal 0–999,999,999 and the ordinals in
      scope, with agreement — 100% covered, every integer 0–1000 pinned
- [x] `rulesFor` returns the rules a number exercises
- [ ] The build fails if a rule has no matching pattern record
- [ ] The bounded number words carry ids and appear as word cards
- [ ] The `segundo` collision is resolved via the `-` convention, not by renaming
      either sense
- [ ] A numeral exercise generator exists, with the three kinds in §6
- [ ] The drill records attempts against pattern ids, or §4.2's fallback with the
      reason written down
- [x] Numbers are reachable as a category — `numbers` is registered in
      `content/es/topics.tsv` and shown by the Browse category picker. It holds
      27 sentences that use a numeral for counting, a price, a duration or a
      distance; what it cannot hold is 1042, which is what §4.2 is for.
- [ ] `npm run check` passes; `npm run validate:data` reports 0 / 0
- [ ] `npm run build:data` produces no diff on a second run

## 10. Verification

```bash
npm run check && npm run build:data && npm run build
```

Then check the four numbers the request that prompted this task actually named —
10, 27, 136, 1042 — and these, which are where a naive implementation breaks:

| n         | Expected                             | What it catches           |
| --------- | ------------------------------------ | ------------------------- |
| 16        | `dieciséis`                          | solid form, accent        |
| 17        | `diecisiete`                         | no accent — blanket rules |
| 21        | `veintiuno` / `veintiún libros`      | apocopation               |
| 27        | `veintisiete`                        | solid twenties            |
| 31        | `treinta y uno`                      | `y` joins units           |
| 100       | `cien`                               | bare hundred              |
| 101       | `ciento uno`                         | **no** `y` after hundreds |
| 136       | `ciento treinta y seis`              | both rules in one number  |
| 200       | `doscientos` / `doscientas casas`    | hundreds agreement        |
| 500       | `quinientos`                         | irregular hundred         |
| 1000      | `mil`                                | never `un mil`            |
| 1042      | `mil cuarenta y dos`                 | zero in the hundreds slot |
| 21000     | `veintiún mil`                       | apocopation before `mil`  |
| 100000    | `cien mil`                           | never `ciento mil`        |
| 1000000   | `un millón` / `un millón de personas` | takes `un`, and `de`      |
