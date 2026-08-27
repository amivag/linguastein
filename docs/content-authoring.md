# Authoring content

The rules for editing `content/<tag>/*.tsv` and for the build that turns it into
`public/packs/`. Split out of [AGENTS.md](../AGENTS.md) when that file passed
seventy kilobytes; the rules here are as binding as the ones that stayed.

This is the **authoring** half. Its companion is
[dataset-format.md](dataset-format.md), which is the **record** half — the columns,
the JSONL shapes, the manifest and the validation boundary. Roughly: read this one
before writing a row, and that one before changing what a row can contain.

Two facts hold up everything below, and breaking either is how a learner loses
their history:

- **`content/es/*.tsv` is the source of truth. `public/packs/**` is generated**
  by `npm run build:data`, and CI fails if the two disagree.
- **An item id is permanent.** Learner progress references it, so a row keeps its
  id through a typo fix, a reordering or a move to another file, and a deleted
  row's id is retired rather than reused.

## One build, many languages

`npm run build:data [language]` builds `content/<tag>` into `public/packs/core-<tag>`.
The tag decides the sources, the pack id, the file names and the language module;
nothing else selects a language, so there is no way to build `de` from
`content/es` or to label a Spanish pack German.

Everything language-specific arrives through **one seam**:
`LanguageModule` in [src/languages/types.ts](../src/languages/types.ts), loaded by
tag from [src/languages/index.ts](../src/languages/index.ts) with a dynamic
`import()`. The `import()` is the point rather than a style choice — a static map
would put Spanish's conjugator in memory for a German build, and
`tests/data/second-language-build.test.ts` proves it does not by declaring
`tener` regular in a German fixture, which the Spanish table would reject.

**Every capability on the module is optional, and absence is the answer.** A
language with no `verbs` emits no verb forms; one with no `numerals` skips the
numeral gates entirely rather than reading every `NUM` row as unspellable. So a
tag with no module at all builds a pack of its sentences and derives nothing,
which is the honest first state of a new language — and a noun still ships its
singular, because a singular _is_ the lemma and needs no morphology. What you
must not do is add a stub that returns nothing: an empty paradigm is
indistinguishable from a word that has none.

Two things about a pack are authored beside its content rather than in the build:

- `content/<tag>/pack.tsv` — the version, item count and date, which change with
  the content
- `content/<tag>/manifest.tsv` — the name, description, licence, gloss language
  and accents, which are what the pack _is_. Key–value, every key optional, each
  falling back to something plainly derived from the tag so a language builds
  before anyone has written its blurb

`referenceLanguages` is deliberately **not** authored: the build derives it from
the translation records it actually emitted, so a manifest cannot claim a
language the pack has no translations for. One translations file per language,
named for it, so a second reference language is a file beside the first rather
than a change to it.

The catalog is derived too — every directory under `public/packs` that holds a
`pack.json`, sorted. It was a literal naming `core-es`, which was right for one
pack and silently wrong for two: building German would have written a catalog
listing only German, and every Spanish course would have vanished from the app
without a file being deleted.

`scripts/generate-audio.ts` takes `--language` for the same reason. It read
`content/es` and wrote into `core-es` from literals, so generating audio after
building German would have spoken the wrong pack and said nothing about it.

**A mission is a curriculum spine plus a per-language realisation.**
[src/app/missions/spines.ts](../src/app/missions/spines.ts) holds what is not about a
language — the order, the goal, the capabilities, the estimated minutes and the
transfer ladder's guided→independent arc — and
[src/app/missions/es.ts](../src/app/missions/es.ts) holds the passages, the spotlight
line, the learner's speaker part and the response palettes. `resolveMissions`
joins them into the `MissionDefinition` every screen already reads, which is why
the split touched no consumer. A second language realises the existing spines
rather than authoring new ones; its spine file should be empty.

`rungs` is index-aligned with its spine's `ladder`, as `Passage.speakers` is with
its `items` — the ladder is ordered and the order is the meaning. A length
disagreement is a bug, not a shorter ladder, and
`tests/domain/mission-spines.test.ts` says so. `level` sits on the realisation
rather than the spine because grading does not transfer between languages.

**A neutral default with a per-language override is the house pattern.** It has
now come up twice — a capability's description and a transfer rung's brief — and
both times the honest count was "almost all of it is neutral, and the exception
names a pronoun". So: put the neutral text in the shared half, let a language
override it, and **gate against an override that merely restates the default**,
or the shared half quietly becomes decoration one row at a time.

## Datasets

A briefed, ready-to-start task for growing the pack lives in
[docs/tasks/dataset-expansion.md](tasks/dataset-expansion.md). Read it before
adding content.

A briefed task for numbers as a generative system — `spellCardinal(1042)` rather
than a thousand rows — lives in [docs/tasks/numerals.md](tasks/numerals.md),
and one for making the UI more enjoyable without making it loud lives in
[docs/tasks/game-feel.md](tasks/game-feel.md). A third
([docs/tasks/function-words.md](tasks/function-words.md)) asks whether the
interrogatives, demonstratives and pronouns should be studiable at all: 123
lexemes have no card, and `ADV` sits in `STUDYABLE_POS` with none behind it.

**Author the content a mission teaches before authoring the mission.** Six
missions landed at once because the vocabulary was already there — travel had 148
items before `buy-a-ticket` existed. The past-tense mission
([docs/tasks/past-tense-mission.md](tasks/past-tense-mission.md)) is briefed
rather than built for the opposite reason: writing the sequence and the language
it drills in one pass is how a mission ends up teaching whatever its author
happened to write that afternoon.

**A capability is shared; a skill is not.** `function` skills are the one part of
the curriculum that is not about a language — "order food or a drink politely" is
the same real-world thing in Spanish, English or Greek, and the slug naming it
was already neutral. So `content/capabilities.tsv` sits _beside_ the language
directories and owns the slug, the neutral description and the prerequisite
graph, while `content/es/skills.tsv` owns only the label and the level. A
function the registry does not name fails the build, and so does a prerequisite
the registry requires but the language has not authored.

Ids stay pack-namespaced deliberately: `core-es:skill:order-food-drink` and
`core-en:skill:order-food-drink` are two things to be good at, and mastery of one
is not evidence of the other. What is shared is the capability, not the skill —
which is why this cost no id migration. See
[docs/dataset-format.md](dataset-format.md) for the columns and the gloss
override, and [docs/tasks/language-matrix.md](tasks/language-matrix.md) §4
for why the reverse direction is what forced the split.

**Every kind of word has cards, and each kind has its own id range.** Sentences
take `1–499_999`, noun cards `500_001–599_999`, modifier cards
`600_001–699_999`, passages `700_001–799_999` and verb cards `800_001–899_999`.
Separate ranges are what stop appending a verb from renumbering an adjective.

Two consequences of verbs having cards, both easy to get wrong:

- **A card is not always the right home for a gloss.** `glossOf` reads
  `verbs.tsv` for a `VERB`, but `hay` is declared in `modifiers.tsv` — it is a
  form, not a conjugatable lemma, and nothing would generate it. So the lookup
  falls through instead of asserting.
- **The `verbs` preset is narrowed to sentences and phrases.** Its description
  promises "useful forms inside natural sentences", and a bare infinitive card is
  exactly what that is not. `vocabulary` is where the cards belong. A preset whose
  filter and description disagree is worse than either.

**Audio is a ledger, not a content column.** `scripts/generate-audio.ts`
synthesises and records into `content/es/audio-ledger.tsv`, and never touches the
pack; the dataset build reads that ledger and emits one `audio` file per locale,
and never synthesises. Three rules hold the seam: only rows a human has marked
`approved` ship, a clip is keyed by (item, locale, voice) rather than by the text
it speaks — an item keeps its id through a typo fix, so the `textHash` is what
tells a current clip from a stale one — and a row whose item has since been
deleted is dropped rather than failing the build. Voices are declared in
`content/es/voices.tsv`, because generated speech is not automatically yours to
redistribute and a voice carries its own licence. No ledger means no audio, and a
pack identical to one built without the feature — **which is the state today**:
neither `audio-ledger.tsv` nor `voices.tsv` is in the tree yet, so both halves of
the code are live and nothing has been generated. `generate-audio.ts` writes the
first one. See [docs/tasks/canonical-audio.md](tasks/canonical-audio.md).

`content/es/*.tsv` is the source of truth. `public/packs/**` is generated by
`npm run build:data` and CI fails if the two disagree.

Item ids live in the first column of the sentence, noun and modifier sources.
Leave the column off a new row — **off, not empty**: the reader strips the first
cell only when it holds an id or the `-` sentinel, so a row starting with a tab
keeps that empty cell and every field lands one place left, which is how a
speaker name ends up being read as a skill. The build assigns an id and writes it
back. Never edit or reorder one afterwards: learner progress references it, so a row
must keep the same id through a typo fix, a reordering or a move to another file.
`content/es/id-ledger.tsv` records every id ever issued so a deleted row's id is
retired rather than reused; it is generated, like the pack. Verb forms come from
`src/languages/es/conjugation.ts` plus the irregularity table — never type a
conjugation by hand, and add an `irregulars.ts` entry when a verb needs one
(the build refuses to run otherwise).

**The subjunctive is generated, and three A-level features turn out to be it.**
`conjugate` emits the present subjunctive at B1 from the yo form's stem plus the
opposite conjugation's endings, and the usted and ustedes commands are read off
persons 3 and 6 rather than derived a second way — a usted command _is_ the third
person present subjunctive, so `imperativeFormal` was the same fact declared
twice and is gone. Seven verbs declare a whole paradigm: six because they have no
usable yo form (`soy` would give `soya`), and `reír` because its stem loses an
accent when the stress moves onto the ending (`riamos`, not `ríamos`).

Two things this makes easy to get wrong, both caught once already:

- **`tense: 'present'` no longer identifies a paradigm.** The subjunctive carries
  it too, so anything selecting on tense alone gets twelve forms where a
  paradigm has six. `formSuffix` keys on mood as well, or `hablo` and `hable`
  would both be `hablar-pres-1s` and the second would win silently; the skill
  loop asks mood first, or every subjunctive sentence is filed under
  `presente de indicativo`.
- **A subjunctive reading needs a trigger, and only where a second lexeme is at
  stake.** `entre` is the preposition in `entre las dos` and `entrar`'s
  subjunctive in `que entre`, so `disambiguate` prefers the ordinary word unless
  a trigger sits immediately before — `SUBJUNCTIVE_TRIGGERS`. Scanning further
  left would read `Creo que entre las dos hay tiempo` as a subjunctive. But the
  preference must not fire when every candidate is the _same_ verb: a usted
  command is indexed wherever no other lexeme claims the surface, so the only
  alternative to `salga` the subjunctive is `salga` the command, and preferring
  it shipped `Ojalá que todo salga bien` marked `usted` with nobody in it.
- **`retagCommand` accepts a subjunctive opening, not only an indicative one.**
  It existed because a tú command is spelled like the third person present; an
  usted command is spelled like the subjunctive, which is now the reading that
  arrives. Asking for `indicative` sent `Gire a la derecha.` back to being a
  statement.
- **A negative command has to open its clause.** `no` plus a subjunctive is not
  enough: `Ojalá no llueva mañana` and `Espero que no vengas` are the same two
  words in the same order and neither orders anybody about.

**A form id must be unique, and the build now checks it.** The ids are built from
a stem plus `formSuffix`, and both halves can collide. `formSuffix` had a comment
about its half and nothing watched the other: `slug` folded a combining tilde
away, so `eñe` and `ene` produced one stem and one letter's plural shipped under
the other's id, silently. Two changes hold it now — a form id's stem comes from
the **lexeme id**, which `lexemeId` already keeps unique, rather than from a
second independent `slug` call; and `slug` maps `ñ` to `nn` before the accents
come off, so `año` is no longer `ano` and the pairs no content has reached yet
(`caña`/`cana`, `peña`/`pena`) cannot collide either.

**Pack file names carry the level range, and the build derives it.** `es-a1-a2-core-*`
was typed into ten paths; `filePrefix` now comes from the same `presentLevels` the
manifest uses, so the first B1 sentence renamed all nine files on its own. Two
consequences. The build deletes any `.jsonl` it did not write, because appending
to the directory left the old set beside the new one for the service worker to
precache. And nothing else may spell one of these names: `readItems` in
`generate-audio.ts` and `packFile` in `tests/fixtures/dataset.ts` both ask the
manifest, after thirteen suites broke at once on a rename none of them was about.

**The alphabet is a module, not rows.** `src/languages/es/alphabet.ts` holds the
twenty-seven letters and their names, including the regional ones (`ve corta`,
`i griega`) — `ch` and `ll` stopped being letters in 2010 and are deliberately
absent. `spellWord` reads any word out, accent included, because `Gomez` spelled
without one is a different surname. Only eighteen letter names are word cards: the
five vowels are named after themselves, and `de`, `te`, `ve` and `ese` are spelled
exactly like a preposition, a pronoun, an imperative and a demonstrative, so a
second lexeme for any of them would make the ordinary word ambiguous everywhere it
appears. Those are taught in sentences instead. A row filed under the `alphabet`
topic is checked against the module, as a `NUM` row is against `numerals.ts`.

**A letter's name and a letter's sound are two different facts, and the module
holds both.** For a long time it held only the first: it could say that `h` is
called `hache` and not that it is silent, which is the most useful thing about it.
Every entry now carries `say` (the name respelled, for a device with no Spanish
voice), `sound` (what it does inside a word), `examples` and `notes` — plus two
lists beside the twenty-seven: `DIGRAPHS` for the pairs that spell one sound and
`MARKS` for the accent and the diaeresis. Keeping those apart is what lets the
chart teach `ll` while the alphabet still honestly counts twenty-seven, and
`tests/languages/alphabet.test.ts` holds the invariant that catches the mistake
this shape invites: an example has to contain the letter it is filed under.

That half is prose in the reference language and is deliberately **not** content.
It is what a chart on a wall says; the moment a letter is something a learner is
_tested_ on it needs an id in `content/es` that progress can reference, which the
eighteen letter-name cards and the thirty-seven alphabet sentences already have.
`features/study/AlphabetSection.tsx` renders it, and nothing there records
anything.

Letter cards are exempt from the recycling target for the reason numerals are —
a closed generated set drilled as a set — and the exemption keys on the **card's
lexeme id**, not on the lemma: `isLetterName` answers true for `a`, `o`, `de`,
`te` and `ese`, and exempting those quietly dropped the A1 population by five and
reported an improvement nobody had earned.

A tú command is spelled like the third person present, so the build cannot tell
`Cierra la puerta` from `La tienda cierra` on its own. Declare `address` on a
sentence that is a command and it is read as one; leave it off and it stays
indicative. Do not "fix" this by guessing from word order — `Hace frío` and
`Está muy cerca` would both become commands.

The shipped pack is marked `source: generated, review: unreviewed`. Do not
describe it as reviewed curriculum.

Editorial review is per item and incremental. `content/es/reviewed.tsv` is the
one file in `content/es` a human writes _about_ content: an entry marks that item
`review: reviewed` in the pack. Sign-off is pinned to the wording that was read,
because an id deliberately survives a typo fix — edit a row after sign-off and
the build fails rather than letting it inherit an approval nobody gave. Never add
an entry for content you have not read: the field exists to keep generated
material distinguishable from checked material, and a forged signature destroys
that. `npm run review:data` finds the rows worth a reviewer's attention, and
stops raising a finding once every item in it is signed off.

A row whose id column holds `-` contributes a lexeme and its meaning but no word
card. Two things use it. A noun and an adjective sharing a surface form — the noun `frío`
and the adjective `frío` would otherwise be two identical cards splitting one
word into two ids. And a word no sentence uses yet: every word card must have an
example sentence to show it in, so `dieciséis` is a lexeme with a gloss until one
exists, and becomes a card the day it does — with no edit to its own row. The
word stays practisable in sentences and inspectable when tapped either way.

Numerals are generated, not authored. `content/es/modifiers.tsv` carries the
`NUM` rows, but the build cross-checks every lemma against
`src/languages/es/numerals.ts` and refuses a spelling that module would not
produce, so `dieciseis` without its accent fails rather than shipping. Numbers
above the card set are not rows at all — `spellCardinal` composes them, which is
why 1042 is askable without existing anywhere. See
[docs/tasks/numerals.md](tasks/numerals.md). No two items may carry the same text, and the build checks this across
sentences and word cards together.

**Ordinals are generated too, and recognised rather than declared.** There is no
`ORD` tag — Spanish ordinals are adjectives, so they are plain `ADJ` rows — and
the lemma is what declares one: `parseOrdinal` accepts exactly the twenty
citation forms `numerals.ts` can spell, so no ordinary adjective is mistaken for
one and a hand-typed `septimo` fails the round trip. Never author `primer` or
`tercer` in the extra-surfaces column; `spellOrdinal(n, { beforeNoun: true })`
derives them, and the build rejects a row that types them by hand. The shortened
form is indexed but is deliberately not a `forms` record: `primer` and `primero`
are both masculine singular, so the two would be indistinguishable in a paradigm
list, and the `ordinals` pattern is what teaches the shortening instead.

**Every inflected form is a `forms` record, whatever its part of speech.** Verb
conjugations were once the only kind, and the record and its pack file both said
`verb-form`. A noun's plural and an adjective's four agreement forms are the same
kind of fact from the same language module, so they ship the same way and
`repository.formsOf` reads them all — which is what lets tapping `verduras`
answer "what is the plural" and not only "what does it mean". The forms were
always generated; for a long time the build used them only to link a surface back
to its lemma and then threw them away. The surface index is now driven from the
same records, so what a learner can be shown and what a sentence can link to
cannot drift apart. One exception is deliberate: an adjective's apocopated form
(`buen`, `gran`, `mal`) is a shortening rather than an agreement, no rule produces
it, and it stays in the extra-surfaces column.

Passages group several sentences into one connected text (a paragraph or a
dialogue). Membership is authored in the `passage` column of a sentence row; the
build derives a container record that _references_ items rather than holding
text, so each sentence stays independently practisable and mastery keeps counting
distinct sentences per word. Never give a passage its own copy of the text — the
build fails on that, as it does on the duplicate text it tends to produce.

Thematic categories are a controlled vocabulary. `content/es/topics.tsv` is the
registry: slug, label and display group, in the order the category picker shows
them. The build fails on a topic no row declares, which is what stops `colours`
and `colors` both quietly existing with half the content each; it reports
registered topics that nothing uses rather than failing, so a category can be
declared before the content that fills it. A slug is referenced by content and by
links (`?topic=clock`), so renaming one is a breaking change — change the label.
Sort the file by hand, never alphabetically: its order is the UI's order.

Communicative functions are skills, not topics. `content/es/skills.tsv` declares
authored abilities such as ordering food, and sentence rows reference their local
slugs in the `skills` column. A topic says what a sentence is about; a function
says what the learner can accomplish with it. The build resolves both skill and
prerequisite slugs and rejects undeclared ones. Grammar and morphology skills are
still generated, so do not re-author them there.

Content carries usage as data, not prose: `register`, `address` (tú/usted) and
`regions`. `address` is derived from morphology where unambiguous and declared
otherwise; third person is never guessed. When adding a word that differs by
region, add both sides of the pair — one alone teaches a dialect as universal.

**`regions` takes `es-ES` or `es-419` and nothing finer.** Spanish carries the
Spain / Latin America split only: a country-level tag reads as precision the app
cannot act on, and it offered chips with one word behind them. Two rules follow
from it. A word used in _most_ of Latin America is `es-419` even where a country
or two says otherwise — the alternative is a list nobody maintains. And a word
whose regional fact is a **sense** rather than a variation carries no region at
all: `camión` means lorry everywhere and a bus in Mexico, so it says that in its
gloss instead of claiming to be Mexico's word. See
`docs/tasks/language-matrix.md` §1.
