# Screens, and the URLs that describe them

How the app is divided into screens, and — the part that is load-bearing — how
each one's state is spelled in the address bar. Split out of
[AGENTS.md](../AGENTS.md) when that file passed seventy kilobytes; the rules here
are as binding as the ones that stayed.

One rule underlies all of it, and it is the reason this is a document rather than
a set of component decisions: **the URL is the state.** A screen is an address. A
session is fully described by its query string, so it can be reloaded, shared,
scripted and driven by an agent. Every spelling below is owned by exactly one
codec module — `session-url.ts`, `browse-url.ts`, `read-url.ts`, `study-url.ts`,
`settings-url.ts` — and built through it, never by concatenation.

## Home and Study

Two sections, and the split is the domain's rather than the nav's invention:
`mode: 'study'` records nothing and only `mode: 'practice'` feeds the scheduler.
**Study** (`/study`) is the material — sheets of words, phrases, sentences, texts
and grammar patterns; **Home** (the course home, `/`) is where a learner lands and
where a session starts. Browse and Read are sheets _inside_ Study, not
destinations of their own: `AppNav` gives the Study item an `owns` list so the
section stays marked while a learner is on one, and both keep working as deep
links.

Home used to be called **Test**, which was accurate about what it did and wrong
about where it sat. It is the address `/` redirects to, the one every deep link
resolves into, and the screen a learner sees after three days away — so naming it
after an activity meant the app opened _inside_ one of four things you could be
doing, with nothing that said what this course is or where you had got to.

So Home answers that first and recommends second, in this order:

0. **A lookup box**, above all of it. "What does this word mean" is a question a
   learner has while doing something else, which is the argument `VoicePresence`
   makes for sitting in every header; Home is where they land, so it sits here.
   A live query _replaces_ the four sections below rather than pushing them down —
   none of them is about the word being looked up — and clearing the box brings
   them back. See "Lookup is not a filter" for the derivation behind it.
1. **The recommendation**, unchanged: due reviews if there are any, otherwise the
   next unfinished mission, then at most two follow-ups.
2. **Where you left off** — the last five _distinct_ items practised, tappable
   like language anywhere else, plus the last three sessions. "Practise this
   again" starts a session at `?focus=recent`.
3. **In this course** — one row per kind of material with its count and its
   categorical hue, each linking to the Study section that holds it. Counted with
   the filter the row links to, and a row with nothing in it is not offered.
4. **How far you are** — the glance version of Progress, which keeps the detail.

`focus=recent` is worth understanding before touching the planner. It is a _bias_,
like every other focus, so it cannot hand back an empty session — but it is the
one focus that orders **across** the planner's buckets rather than permuting them,
because "what I was just working on" is orthogonal to whether an item is due, weak
or settled. `domain/sessions/planner.ts` says so where it special-cases it. The
alternative was `?ids=`, which `session-url.ts` rules out: a session has to be
describable by its address, and thirty item ids is not a link.

Nothing on Study is a hard-coded list. Word kinds, categories and grammar
patterns are counted from the packs over the current course, so a second
language grows tiles with no edit — and a tile whose count is zero is not
offered, the same rule the categories and the letters already follow.

**Alphabet is the one section that is not counted from the packs**, and it is not
an exception to that rule so much as the other half of it. Whether a course has an
alphabet chart is a property of the _language_, not of how many rows are filed
under a topic, so the tab is decided by `alphabetGuide(tag)` in
`src/languages/runtime.ts` — which returns a **loader** rather than a promise
precisely so the answer is synchronous. A section that appears a frame after every
other section is a tab that moves under a thumb; the chart itself still arrives in
its own chunk, only for the learner who opens it. See "The alphabet is a module,
not rows" below for what is in it.

**Study is one section at a time, and a section is an address.** All of it on one
page came to about seventy rows in the shipped course, where thirty-five
categories buried the three sheets above them. `features/study/study-url.ts` owns
`?tab=grammar` in both directions, exactly as `browse-url.ts` owns the filters.
Two details are deliberate:

- **The section list is derived too**, not just the tiles in it. A course with no
  authored missions has no Missions tab, because a tab that opens an empty page
  is the same mistake as a tile advertising 546 verbs.
- **The default is data, so the link spells the tab out.** Browse omits its
  default sort and Settings its default section, because those defaults are
  constants; Study's first section depends on what the packs hold, and a link
  that meant Missions in one course and Words in another is exactly what a shared
  link must not be.

**Grammar and abilities are two sections, because they are two kinds of thing.**
A `pattern` is how the language works; a `function` is what a learner can
accomplish with it — the distinction the dataset already draws (see
`content/es/skills.tsv`). One list put `presente de indicativo` beside `Pedir
comida o bebida`, forty-one tiles deep. Only `function` is named in the split, so
a skill kind added later lands in Grammar rather than disappearing from the
screen.

The course scope is a one-line summary that opens `CourseBar` in a sheet, the
trade Test already makes for its session options: four lines at the top of every
screen is a lot to spend on something a learner changes once a week. It still has
to _state_ the scope, because every count under it is relative to that.

**Count a tile with the filter the tile links to.** This is easy to get wrong and
was: the word tiles were counted with `partsOfSpeech`, which counts every item
_exemplifying_ a part of speech — sentences included — while the tile links to a
sheet of word cards. That advertised 546 verbs where the sheet lists none.

**Missions belong to Study.** A mission is mostly material — an exchange to
understand, then the same language used somewhere new — so the catalogue lives on
Study, listed in authored order with each one's standing. Test keeps leading with
the next unfinished one, because a recommendation is what that screen is for, and
links across to the full ladder rather than being the only way in.

Only the Use stage records anything, and Study says so: the rest of that screen
promises the opposite, so a control that records has to qualify the promise rather
than quietly break it.

Where a learner stands is **derived, never stored** —
`domain/missions/progress.ts` computes it from the attempt log, and both screens
call it. It was inline in the home screen before, which is why Study could not
list missions without copying the calculation. The Use-stage session id
(`mission:<id>:use:<passage>:<stamp>`) is built and parsed there too, for the same
reason: it was spelled out in three places.

## Browse's URL, and the filter spelling

A study sheet is a thing you link to, so Browse's filters live in the query
string (`?type=word&pos=noun&topic=body&sort=az`) rather than in component
state. `features/browse/browse-url.ts` owns both directions, exactly as
`session-url.ts` does for a session.

The facet spelling itself belongs to neither: `writeItemFilter` and
`parseItemFilter` are exported from `session-url.ts` and used by both, so
`?pos=verb` cannot come to mean one thing in a sheet and another in a session.
Add a facet there, not in a screen.

`sort` is the exception and deliberately so — it narrows nothing, so it stays in
Browse's URL and never travels into a session link, where `ordering` is the
session's own business.

**A sheet carries the section that opened it.** Browse and Read send Back to
Study rather than into history, because a learner who followed three category
tiles should not have to tap Back three times to leave. The other half of that
choice was a bug: bare `/study` resolves to whichever section the course
_starts_ with, so leaving a category landed you on Missions — Back undid the
navigation the learner made and the section switch above it, then dropped them
on a screen they had never asked for. So every sheet link Study builds carries
`?from=<tab>` and each sheet's Back goes to `studyPath(course, from)`.
`study-url.ts` owns that spelling in both directions (`writeStudyOrigin` /
`parseStudyOrigin`), because the section names are Study's; `browse-url.ts` and
`read-url.ts` only pass it through. Three details matter:

- **It is provenance, not a facet.** It narrows nothing and never travels into a
  session link, so it lives beside `sort` rather than in `writeItemFilter`.
- **Narrowing the sheet must not drop it.** Every rewrite of Browse's query is a
  `replace` that carries `from` through: a Back button that forgets where you
  came from because you touched a filter is the original bug again.
- **Study reads it off the open section**, not out of a literal per link, so no
  two links on one screen can disagree and a section added later needs no edit.
  An absent or unrecognised name degrades to Study-wherever-it-opens, which is
  what a shared link and a reload get.

The general rule, worth stating because it is easy to break one control at a
time: **Back may cost a learner one step, and it may never cost two.** It must
also never land somewhere they have not been — the reason `MissionScreen`'s
"Back to missions" and its finish button go to the missions ladder on Study
rather than to `path()`, which is the course home and the one screen a mission
was not reached from.

## Lookup is not a filter

Two things in this app take a typed word, and confusing them is the mistake to
avoid. `ItemFilter.search` **narrows a sheet** of practisable cards and answers
"which of these match". `searchContent` in `domain/content/search.ts` **answers a
question about the language** — what this word means, which form it is, what it
turns up in, and where the app teaches it. Home carries the second; Browse's box
is still the first.

The piece that had to be built was the one primitive neither had: a **surface
index at runtime**. Every other index in the repository starts from an id the app
already holds, because `build-dataset.ts` resolved surfaces at build time and put
them on tokens — so `inspectToken` needs no lookup at all, and a learner who
typed `tengo` had nothing to look it up with. `repository.lexemesOfSurface` is
built in `add()` from the lemma and `forms` records already in memory: no pack
format change, no build step, and 9,000 surfaces for the shipped course.

Five rules hold the derivation together, and each one was a wrong answer first:

- **Both languages, no toggle.** `agua` and `water` are one lookup from opposite
  ends, and asking a learner to say which they typed is asking them to know the
  answer before they search. The reverse direction needed
  `repository.translationsIn`, since `translationsByRef` only ever answered
  forwards — which is why Browse's box has claimed to search English since it
  shipped while `query` only ever matched `item.text`.
- **Ambiguity is a result, not a problem.** `entre` is a preposition and
  `entrar`'s subjunctive; `fui` is `ser` and `ir`. The build picks a reading from
  the words either side (`disambiguate`); a query has no context, so every
  reading is shown. But an accent is not ambiguity: `de` folds onto `dé`, so a
  spelling that matches exactly beats one reachable only by folding, or `un vaso
de agua` answers with `dar`.
- **Several words is three cases, not one.** The whole string may be a single
  headword (`por qué`, and every English phrasal verb), or several words, or a
  phrase. Splitting first breaks the first case irreparably — nothing downstream
  can put `por` and `qué` back together.
- **Scope is a bias, never a filter**, the rule a focus and the speaker's gender
  already follow. A learner on A1 searching a B1 word gets it, marked: "no
  results" cannot tell them whether a word is absent from the packs or above
  their level, and those have different fixes. `beyondScope` therefore requires
  the word to _have_ phrases none of which are in scope — nothing to be beyond is
  not the same as beyond, and the shipped `por qué` proved it.
- **Nothing is answered twice.** An exact phrase is the answer, so it is excluded
  from its own words' examples; and a loose phrase match is dropped once a word
  entry already shows it, or every sentence containing `tengo` appears under two
  headings.

`searchContent` takes an `ItemFilter` rather than a `Course`, and that is the
whole extensibility of it: **searching inside a Study section, a category or a
part of speech is this same call with a narrower filter.** Do not add a second
code path for it. `features/search/` holds the box, the results and the `?q=`
codec so all three can move to another screen unchanged; `q` is deliberately the
same key `writeItemFilter` uses, because one name for "the text a learner typed"
means a query survives being carried between screens.

One trap, and it bites any box whose value is the URL: **do not trim the query on
the way in.** A trailing space thrown away between keystrokes makes the next
letter land against the previous word, so `cerveza agua` arrives as
`cervezaagua` and no phrase can be typed at all. `writeSearchQuery` stores what
was typed and whoever _searches_ trims. Browse still has this bug.

Missions are absent from the domain's results on purpose. A mission points at a
_passage_, so `missionsUsingPassage` in `domain/missions` derives them from the
passages the search returned, and content never learns what a mission is.

## Settings, in sections

Six sections rather than one column, grouped by _whose_ setting it is: You,
Learning, Appearance and Audio are the learner's; Packs and About are the app's.
One file per section under `features/settings/`, and the shell only picks between
them.

**First and default are two different questions.** `user` leads the strip
because it is the person rather than the app; `learning` is what a bare
`/settings` opens, because a name and a gender are set once and then read, while
the course, the reference language and the session behaviour are what somebody
comes here to change.

The open section is in the query string — `/es/a1/settings?tab=packs` — and
`settings-url.ts` owns both directions, exactly as Browse and a session do. The
default is left unsaid in the link, and an unrecognised name opens the default
rather than erroring. The switcher is a `nav` of links with `aria-current`, not a
`role="tablist"`: a section here _is_ an address, and half an ARIA tab widget
promises arrow-key semantics that a set of links does not have.

**Audio is two directions, and the failing one is input.** The Audio section
holds playback (the voice picker, shared with the header's voice menu) _and_ a
speech-input check: what this device supports, a listen the learner can run on
purpose, and the steps for whatever it reports. It exists because speech input
fails for reasons that are not in the app — an insecure page, a permission, a
browser with no recogniser, or an Android device whose _separate_ speech service
has no language downloaded — and an exercise has room for one sentence.

Two rules hold here. The microphone and the recogniser are different things and
must be reported separately: on a phone the browser opens the microphone and a
system app transcribes, so `service-not-allowed` is the recogniser refusing and
sending that learner to a microphone permission fixes nothing. And every surface
reads one vocabulary — `describeSpeechFailure` in `audio/failure.ts`, with the
platform from `audio/support.ts` deciding which settings screen the advice names.
Add a cause there, never in a component; the terse copy an exercise shows and the
steps Settings shows are the same object.

**A content pack is an add-on, and Settings treats it as one.** It ships,
versions and is licensed separately, so the Packs section lists each one with its
version, levels, accents, licence and provenance, and counts what it holds through
`domain/content/packs.ts` — counted from the repository rather than read out of
the manifest's prose, and with the filter each label describes. Two rules matter
here: a pack that has not been editorially reviewed says so, because generated
material must stay distinguishable from checked material; and a skipped record is
attributed to the pack whose file it came from, since a number floating on the
screen names nothing to fix.

## The learner, and the one setting that changes content

Settings' **You** section (`/es/a1/settings?tab=user`) is the learner rather than
the app: a name, the gender they speak about themselves in, and an account of
what this device is holding. There is no account behind any of it yet
([accounts-and-sync.md](tasks/accounts-and-sync.md)), which is why the
section says where the data lives before it says how much of it there is — and
names the store rather than gesturing at it: the IndexedDB database (from
`identity.ts`, never typed out), the `localStorage` mirrors, the packs as the
app's material rather than the learner's, whether the browser has promised to
keep any of it, and _no servers_, said as its own row because "where is it" has
an answer about the network too.

It was `/user`, a screen of its own outside the course routes, on the argument
that a name is not a property of what is being studied. True, and not the
deciding fact — a theme is not a property of Spanish either, and Appearance has
always lived in Settings. What the separate address actually bought was one link
above the tab strip pointing at a screen nothing else reached, so the two things
a learner would look for under "me" were the one thing Settings did not contain.
`/user` still resolves: `App.tsx` redirects it into the tab, spelling the
destination through `settingsPath` rather than as a second path literal.

**Gender here is grammar, not a demographic**, and it is **a bias, never a
filter** — the rule `focus` already follows, and here for a sharper reason.
Spanish makes a learner commit before they can say anything about themselves, so
a learner led with `Estoy cansado` when `cansada` is theirs is being led with a
sentence that is not true of them. But the other half is Spanish they have to
understand: other people describe themselves all day. So both halves stay in the
course and in every session's candidates, and the setting decides only which is
met _first_, where nothing else already decides the order (`ownFormFirst` in
`domain/sessions/planner.ts`).

Three rules hold it together:

- **Unsaid is a real answer and the default.** No gender means no reordering, and
  a learner who never opens the You section sees exactly what they saw before it
  existed.
- **Nothing is ever removed.** A session with room for both contains both;
  `tests/domain/speaker-bias.test.ts` asserts it, because "prefer" quietly
  becoming "only" is the regression nobody would see.
- **A wrong marking is worse than a missing one.** The derivation gives up on
  every ambiguous case rather than guessing — see
  [dataset-format.md](dataset-format.md) for which, and
  `tests/data/speaker-gender.test.ts` for the traps that produce false positives.

## Courses and the URL

Every screen lives under `/<language>/<level>` — `/es/a1/browse`,
`/es/all/read/700001`, `/es/a2/session?preset=verbs`. `/` is a redirect, not a
screen: it sends the learner to the course they left, from the stored
`targetLanguage` and `level`.

The path is the source of truth, exactly as the query string is for a session.
The preference exists only to decide where `/` lands. Build a course-scoped link
with `coursePath` and a session link with `sessionPath(course, …)` — never by
concatenation, for the reason `session-url.ts` records: a hand-spelled prefix is
one that can go stale.

A language or level that is not loaded resolves to the widest real course rather
than an error, so a stale bookmark degrades instead of breaking. Paths written
before courses existed (`/session?…`, `/read/700001`) redirect into a course and
keep their query string.

**An address the app does not have is a 404, not a redirect.** Only `/` redirects,
because the app has no course-less home. Everything else unrecognised gets
`NotFoundScreen`, which quotes the address back — the one fact the learner does
not already have, and what separates "the app is broken" from "that link is
wrong". There are two routes on purpose: `/:language/:level/*` is matched first so
the 404 keeps the course it was reached from, and the global `*` catches the rest.
Redirecting instead, which is what this replaced, gave a stale bookmark, a moved
screen and a typo the same treatment — a working page that was not the one asked
for, with nothing to say so.

**Missing content says what is missing and what would provide it.** A passage or
mission id no loaded pack has names the id, says it may belong to a pack that is
not installed, and links to Settings → Packs. "Not found" alone cannot distinguish
a broken link from an add-on a learner does not have, and those have different
fixes.

**A link addresses content by local id, and that is only unambiguous while local
ids are.** `?passage=mercado` and `?skill=preterite` deliberately carry no pack
namespace, so `passageByLocalId` and `skillByLocalId` resolve by first match. With
one pack that is free; with two it opens whichever loaded first, which is worse
than an error because it is confidently wrong. `validateAcrossPacks` reports the
collision as an error — in `validate:data` and in `loadPacks` — so it cannot be
silent. Making two packs genuinely coexist is a decision, briefed in
[docs/tasks/pack-addressing.md](tasks/pack-addressing.md); do not add a
second pack of the same language before reading it.

`courseOptions(repository)` derives what is on offer from the packs themselves,
so a second language pack appears in the picker — and in the URL — with no code
change. `tests/fixtures/pack.ts` ships a small French pack for exactly this:
anything that assumes one language or one pack fails there.

The router itself is the one vendor here with no seam: `react-router` is named in
eighteen files under `src/`, which is why replacing it is a task rather than a
bump. The briefed migration to TanStack Router —
[docs/tasks/tanstack-router.md](tasks/tanstack-router.md) — starts by
introducing that seam, so the first commit is worth landing whichever router
wins. Read it before adding a route, and do not adopt `validateSearch`: the URL
codecs drop unrecognised values on purpose, and it throws.

## What a session practises

Three things narrow it, and they are deliberately different kinds of thing:

- the **course** (path) — the standing context: which packs, which levels
- the **focus** (`?focus=`, stored as a preference) — which items to _lead with_
- the **filter** (`?topic=`, `?type=`, `?pos=`, …) — an explicit narrowing a
  learner picked

A focus is a bias, never a filter. `SESSION_FOCUSES` reorders the four buckets
the planner already sorts into — due, weak, new, the rest — so "the ones I keep
getting wrong" cannot hand back an empty session on the day nothing is weak. Do
not turn one into a filter; that is the whole reason it is expressed as an
ordering.

The stored focus and topics are written _into the session link_ by whoever starts
the session, rather than read from preferences by the session screen. A session
that is not fully described by its URL cannot be reloaded, shared or scripted —
and a shared link must not practise the sharer's categories on someone else's
device.

`maxNewItems` still caps unseen material in an open-ended session, except under
`focus=fresh`, where new material is exactly what was asked for.

A word kind (`?pos=verb,noun`) is a filter like any other, and deliberately a
_kind_ rather than a list: `ItemFilter.lexemes` answers "these exact words", and
spelling "the verbs" that way meant enumerating every verb lexeme in the pack at
the call site. Which kinds a picker offers comes from `partsOfSpeech(scope)` — the
packs' own counts, empty ones dropped — narrowed to `STUDYABLE_POS`, because `de`
and `el` are not a category anyone asks for.

A letter (`?initial=c`) is a filter too, and a sort is not. Browse offers both
and they are different kinds of thing: the letter changes which items exist, so it
belongs in `ItemFilter` and in the link, while `ItemSort` only decides the order
the list is dealt in on that screen and is deliberately not written into a session
— see `ordering` below for why a session's order has to be asked for. What
"alphabetical" means is defined once, in `domain/content/alphabet.ts`: leading
punctuation is stepped over so `¿Qué hora es?` files under Q, accents fold, and
`ñ` is a letter rather than an n. Do not re-derive any of that at a call site — a
letter index and a sort that disagree are two alphabets.

A **skill** (`?skill=preterite,imperfect`) is how a session asks for a tense or a
pattern, and it is the only way to: `ItemFilter` has no morphological field, but
the four grammar skills are attached to items, so the skill _is_ the tense.
Skills travel as local ids for the reason passages do — a shared link should not
carry a pack namespace it will outlive — and are resolved to `SkillId`s by the
screen, since `session-url.ts` deliberately parses without the repository. A slug
no loaded pack declares widens the session rather than emptying it.

`ordering` is the session's, not the preset author's taste: `sequential` means
pack order and must be _asked for_, since a preset that defaults to it deals the
same first N items on every press for the life of the install. Study sessions
record nothing, so nothing else varies what they show.
