# Task: practise feelings, mood and state

**Status:** briefed, not started — requested 2026-08-23
**For:** a fresh agent session, no prior context assumed
**Scope:** content first, then a mission. The engine needs no changes.

Read [`AGENTS.md`](../../AGENTS.md) and
[`docs/tasks/dataset-expansion.md`](dataset-expansion.md) before starting, and
follow the rule they both state: **author the content a mission teaches before
authoring the mission.** Six missions landed at once because their vocabulary was
already there; this one's is not, and writing the sequence and the language it
drills in the same pass is how a mission ends up teaching whatever its author
happened to write that afternoon.

## Why this is worth a task of its own

Saying how you are is the single most-asked question in the pack — the greeting
mission opens with it — and it is the one the learner can least answer. Measured
against the shipped pack:

- **`feelings` has 52 sentences and 9 word cards.** Compare `health` at 74 and 18.
- **Ten lexemes carry the topic**, and three of them are the same word:
  `contento`, `feliz`, `triste`, `tranquilo`, `nervioso`, `estupendo`, `genial`,
  `perfecto`, `regular`, and the verb `alegrar`. Four of those ten are ways of
  saying "great".
- **No skill in `skills.tsv` is about feeling anything.** The topic is reached
  only sideways: `respond-to-wellbeing` (a greeting move), `say-how-the-day-went`
  (work), `say-how-you-feel-about-home` (home) and `describe-a-symptom` (health,
  a2). Each is one line of one other mission.
- **None of the fourteen missions is about it.**

So a learner can be asked «¿Cómo estás?» in four dialogues and has "bien",
"genial", "regular" and "muy cansado" to answer with. That is a mood vocabulary
of four words for adults who are supposed to become usable fast.

## The real content problem, which is grammatical

English does all of this with _to be_. Spanish uses three constructions, and
which one a state takes is not predictable from its meaning:

| construction        | for                             | examples                                    |
| ------------------- | ------------------------------- | ------------------------------------------- |
| `estar` + adjective | how you are right now           | `estoy cansado`, `está preocupada`          |
| `ser` + adjective   | what you are like               | `soy nervioso`, `es muy tranquila`          |
| `tener` + noun      | states English makes adjectives | `tengo hambre`, `tiene sueño`, `tengo frío` |

This is the whole teaching problem, and it is why the topic cannot be fixed by
adding adjectives. `estoy cansado` and `soy cansado` are both grammatical and
mean different things; `tengo hambre` is the only option and `soy hambriento` is
what a learner will produce without being taught otherwise.

**The good news:** the `tener` nouns are almost all already in the pack —
`hambre`, `sed`, `sueño`, `prisa`, `miedo`, `frío`, `calor` are all there. What is
missing is sentences that use them as states and a skill that names the move.

## What to author

**Lexemes first.** Four common state words are absent: `ganas` (as in `tener
ganas de`), `enfadado`, `preocupado`, and `solo` in the "lonely" sense — check
whether the existing `solo` adverb collides before adding an adjective. Add both
halves of any regional pair, per the usual rule.

**Skills**, in `content/es/skills.tsv`, level `a1` except where noted. Pair them
the way the question words were paired in `sentences-questions.tsv` — asking is
one ability and answering is another:

- `say-how-you-are` — beyond "bien": tired, worried, in a good mood
- `say-what-you-need` — the `tener` states: hungry, thirsty, cold, in a hurry
- `ask-how-someone-feels` — past `¿cómo estás?`: is something wrong, are you OK
- `react-to-how-someone-feels` — sympathy and pleasure, which is the move that
  makes the exchange a conversation instead of a form
- `say-what-you-are-like` (a2) — the `ser` half, deliberately later: it is a
  different claim about a person and confusing it with `estar` is the error to
  avoid teaching

**Situations.** Three or four dialogues, in a file of their own. A friend who can
see something is wrong. Someone flagging a physical state mid-plan (`tengo
hambre`, `¿comemos algo?`). A reply that is honest rather than polite — the
learner refusing "bien" is the point of the whole thing.

## Two things to decide, not assume

**Whether `estar`/`ser` earns a generated grammar skill.** The tense skills are
generated from morphology in `build-dataset.ts`; this distinction is not
morphological, so it would have to be an authored `pattern` skill or a
`PATTERNS` entry. Decide which before authoring, because it changes where the
sentences point.

**Whether this becomes one mission or extends `greet-and-respond`.** The
wellbeing answer already lives in that mission's second stage. A separate mission
risks two screens teaching the same move; extending it risks a fifteen-stage
first mission. Look at how `make-yourself-understood` was split out as its own
mission from a similar overlap and follow whichever reading that supports.

## Related

- [`dataset-expansion.md`](dataset-expansion.md) — the authoring workflow
- [`past-tense-mission.md`](past-tense-mission.md) — the same
  content-before-mission shape, worked through
- `content/es/sentences-questions.tsv` — the paired ask/answer skill pattern this
  brief borrows, and a worked example of a four-dialogue content batch
