# Task: give verbs their own word cards

**Status:** not started — investigated only. Every blocking unknown below is
resolved; nothing has been written.
**Written:** 2026-08-20
**For:** a fresh agent session, no prior context assumed
**Scope:** one id range, one column in one TSV, four edits to the dataset build,
and the fallout in the tests and the docs that quote pack counts. No engine, no
scheduler, no UI change is needed — the screens already handle a word card of any
part of speech.

---

## 1. The task in one line

`content/es/verbs.tsv` gains an id column, so its 117 rows become word cards
alongside the 358 nouns and 93 modifiers — and `Words × Verbs` in Browse stops
being an empty page.

## 2. Why

Word kinds became a filter dimension in `a9dc134` (`?pos=verb,noun`, plus a
select in Browse), which is what surfaced the gap: the shipped pack has **no verb
word cards at all**. Its 451 cards are 357 nouns, 78 adjectives and 16 numerals.
Verbs exist only as lexemes plus 2,808 generated forms, reachable by tapping a
word inside a sentence.

So today:

- `Words × Verbs` in Browse finds nothing, and says so — the empty state names
  the filters rather than blaming a search, but there is still nothing there
- the `vocabulary` preset is `types: ['word']`, so it cannot practise a verb
- `hablar` is not a thing a learner can look up, only a thing they can meet

Nouns already work this way and the machinery is all present. This is filling in
a row of the table, not designing one.

## 3. Orientation

Read these first, in order:

1. [`AGENTS.md`](../../AGENTS.md) — the **Datasets** section is the one this task
   is constrained by. Item ids are permanent, `public/packs/**` is generated, and
   the `-` sentinel has a specific meaning
2. [`scripts/build-dataset.ts`](../../scripts/build-dataset.ts) — where all four
   code edits land. Read `readSource` (~line 152) first: it is what decides
   whether a row's first cell is an id
3. [`docs/tasks/dataset-expansion.md`](dataset-expansion.md) §4 — why an id is
   permanent, and what the ledger is for

Then run `npm run check`. It must pass before you start.

## 4. What the investigation established

These were the three things that could have blocked the task. None of them do.

**Every verb already has an example sentence.** The rule that shapes the card set
— a card must have a sentence to show the word in, which is why 22 numerals are
lexemes and not cards — costs nothing here. `npm run build:data` reports
`without an example: 0 verbs`, for all 117.

**No verb infinitive collides with existing item text.** The build refuses two
items carrying the same text, across sentences and word cards together
(build-dataset.ts ~line 1345). Checked all 117 lemmas against the noun cards, the
modifier cards and every sentence: no overlap. So no row needs the `-` sentinel
on collision grounds.

**Id range `800_001–899_999` is free.** The ranges in use are sentence
`1–499_999`, noun-card `500_001–599_999`, modifier-card `600_001–699_999`,
passage `700_001–799_999`.

Also worth knowing: `npm run build:data` is idempotent on the current sources —
running it leaves the tree clean, so any diff after your change is your change.

## 5. The edits

### 5.1 `content/es/verbs.tsv`

Today: `lemma  gloss (en)  level  regularity  topics`. No id column — verbs were
lexemes only, so no row ever needed one.

Add the id column at the front, and document it in the header comment the way
`nouns.tsv` and `modifiers.tsv` do, including the `-` sentinel. **Leave the
column off all 117 existing rows.** `readSource` detects an id by `/^\d{6}$/` on
the first cell, so a row without one parses exactly as it does now, the build
assigns an id and `writeBackIds` writes it into the file. That is the documented
way to add rows, and it means you are not hand-typing 117 ids.

### 5.2 `scripts/build-dataset.ts`

Four edits, each mirroring what the noun path already does:

| Where                       | Change                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `IdKind` + `ID_RANGES` ~389 | add `'verb-card': { first: 800_001, last: 899_999 }`                                                            |
| `VerbRow` ~40, parsing ~191 | add `row: SourceRow`; switch `readTsv('verbs.tsv')` to `readRows('verbs.tsv')` so the file joins `sourceFiles`  |
| id claiming ~464            | a `nextVerbCardId = allocatorFor('verb-card')` loop, `continue`-ing on `row.noCard`, exactly like the noun loop |
| `vocabularySources` ~1291   | a verbs branch: `pos: 'VERB'`, `regions: []`, `register: ''`                                                    |

Plus one that is easy to miss: **`glossOf(lemma, pos)` (~1524) has no `VERB`
branch.** It handles `NOUN` and then falls through to
`modifiers.find(...)!.gloss`, so a verb card would crash on the non-null
assertion rather than fail cleanly. Add the branch before you add the cards.

The console summary at ~1628 (`451 word cards`) needs no edit — it counts — and
the `byPos('VERB')` line in the coverage report keeps reading correctly.

## 6. Fallout to expect

Do not treat any of these as surprises:

- **`content/es/id-ledger.tsv`** gains 117 entries. It is generated; never edit it
  by hand.
- **Category counts shift.** Verb cards carry the topics from `verbs.tsv`, so the
  per-topic counts and the build's `under 8 items` list both move. Check
  `tests/data/topics.test.ts`.
- **`tests/data/doc-stats.test.ts`** exists to keep the numbers quoted in prose
  honest, so the pack counts in `README.md`, `docs/roadmap.md` and anywhere else
  will need updating. Let the test tell you where.
- **`tests/data/duplicate-items.test.ts`, `item-ids.test.ts`,
  `shipped-packs.test.ts`** are the other likely ones.
- **`content/es/reviewed.tsv`** is untouched: new items ship `unreviewed`, and an
  entry must never be added for content nobody has read.

## 7. Two judgement calls left open

Neither blocks the work; both are worth a minute rather than a default.

**Does every verb get a card, including `haber`?** The `-` sentinel is currently
reserved for two cases: a homograph that would ship a card identical to another's,
and a word no sentence uses yet. Neither applies to any of the 117, so the
consistent answer is that all of them get one. But a card for `haber` glossed "to
have (auxiliary)" is not obviously a thing to drill, and the same argument reaches
a little way towards `ser` and `estar`. Deciding "auxiliaries take `-`" would be a
_third_ meaning for the sentinel, so if you go that way, say so in the header
comment and in `AGENTS.md` — the sentinel's meaning being narrow is what makes it
readable.

**Should the `verbs` preset still include word cards?** It is `pos: ['VERB']`
since `a9dc134`, so the 117 new cards join its 388 sentences automatically. Its
description is "Useful forms inside natural sentences", which bare infinitive
cards do not honour. Either narrow the preset to `types: ['sentence', 'phrase']`
and let `vocabulary` cover the cards, or change the description. Do not leave the
promise and the content disagreeing.
