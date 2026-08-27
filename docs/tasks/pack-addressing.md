# Task: address content when there is more than one pack

**Status:** decided 2026-08-26 — see _Decided_ in §3. Resolution is scoped to
the course where a caller means it, and `validateAcrossPacks` is the wall for
the same-language case. Always-qualified links (B) are deferred, not rejected
**Written:** 2026-08-24
**For:** a fresh agent session, no prior context assumed
**Scope:** URL spelling, pack identity and the missing-content path. No content
authoring. The learning engine needs no changes.

Read [`AGENTS.md`](../../AGENTS.md) — especially **Courses and the URL** and the
`session-url.ts` rules — plus
[`docs/architecture.md`](../architecture.md#updates-and-caching) before touching
anything the service worker caches.

---

## 1. Why this needs a decision, not just an implementation

The app ships one pack, `core-es`, and everything about addressing content is
correct **for one pack** and quietly wrong for two.

A URL addresses a passage and a skill by their **local** id:

```text
/es/all/read/700001          the passage whose local id is 700001
/es/a1/session?skill=preterite
/es/a1/session?passage=mercado
```

That is deliberate, and `session-url.ts` records the reason: a shared link should
not carry a pack namespace it will outlive. The cost is that resolution is
first-match-wins, which both accessors say out loud:

```ts
// repository.ts
/** The same first-match-wins caveat as {@link passageByLocalId}: with several
 *  packs loaded a route is only unambiguous while local ids are. */
skillByLocalId(local: string): Skill | undefined {
  return this.allSkills().find((skill) => skill.id.endsWith(`:skill:${local}`));
}
```

With one pack that costs nothing. The moment a second is loaded — an add-on to
the Spanish A-level content, or a B1 pack — two packs can claim `700001` or
`preterite`, and the link opens whichever loaded first. **That is the worst
failure shape available**: not an error, not an empty screen, but confidently the
wrong text.

**Already done, so it is not redone.** Two halves, and they are complementary
rather than redundant:

- **Detection.** `validateAcrossPacks` reports a collision as an error, wired
  into `npm run validate:data` and into `loadPacks`. Covers packs built together.
- **Resolution.** `resolveRef` in `repository.ts` replaced the `find(id =>
id.endsWith(…))` lookups. It accepts a bare `700001` _and_ a qualified
  `core-es:700001`, resolves the bare form while exactly one pack claims it, and
  returns `ambiguous` — naming the packs — when several do. **It never guesses.**
  `PassageScreen` says which packs contested the link, because "no pack has this"
  and "two packs have this" need different words: only the second is fixed by
  qualifying the link. Covers the case validation cannot see, which is a learner
  installing two packs whose authors never met.

So a second pack can be added _safely_ today: the failure mode is now a legible
message rather than the wrong text.

**What is left is one thing, and §3 is still the decision for it: nothing
_writes_ the qualified form yet.** `readPath` and `sessionPath` still emit bare
refs, so a link is portable only while the id is uncontested on the device that
opens it. That was deferred rather than forgotten, for a reason worth weighing
before picking it up: switching the writers churns ~84 URL assertions across the
tests, and the benefit — a link that means the same thing on a device with a
different pack set — only materialises once a second pack exists. Detection and
resolution had to come first because they are what stop a collision being
_silent_; writing qualified is what makes links _portable_.

## 2. What else is already in place

- **404s are real.** `NotFoundScreen` replaced a catch-all that redirected to the
  course home silently, so a stale bookmark, a moved screen and a typo all
  produced a working page that was not the one asked for. There are two routes:
  `/:language/:level/*` keeps the course it was reached from, and the global `*`
  catches the rest. `/` is still a redirect, because the app has no course-less
  home.
- **Missing content names itself.** A passage id that no loaded pack has says
  which id, says it may belong to a pack that is not installed, and links to
  Settings → Packs. Same for a mission, against the course it is not in.
- **Item ids are already namespaced.** `core-es:item:000123`, and progress
  references them, so learner history already survives packs being added and
  removed. Nothing in §3 threatens that.
- **A course already spans packs.** `A course is a scope, not a partition` —
  `courseOptions` derives languages and levels from the packs loaded, so a B1
  pack appears in the picker with no code change. The scope machinery is done;
  only addressing is not.

## 3. The decision

**How should a URL identify content once more than one pack can provide it?**
Three options, and the trade is link stability against unambiguity.

### A. Qualify only when it is ambiguous

`?passage=mercado` stays as it is, and becomes `?passage=core-es:mercado` only
where two packs collide. Shortest links, no migration, and the resolution rule
is "local unless qualified".

Against it: the spelling of a link now depends on what else is installed, so the
same content has two addresses and a link generated on a device with one pack set
is ambiguous on another. This is the option that looks cheapest and is hardest to
reason about later.

### B. Always qualify, with a redirect for the old spelling

`/es/all/read/core-es:700001`, `?skill=core-es:preterite`. One spelling, no
ambiguity ever, and `session-url.ts` already owns both directions so the change
is contained. Old links keep working through the same degradation rule the module
already applies — an unknown slug widens rather than empties.

Against it: it is exactly the pack namespace `session-url.ts` says a shared link
should not carry, and it makes every link longer and uglier for the 99% case of
one pack. If a pack is ever renamed, every link to it is stale — though the id
ledger means ids themselves never move.

### C. A content hash, or a short id, per addressable thing

What the user's question raised: give each passage a stable short id that is
unique across all packs by construction, the way `id-ledger.tsv` already retires
item ids so they are never reused.

Against it: a hash is not readable, and `/read/700001` being legible is a real
property — it is how the reading list, the tests and a person debugging a link
all refer to a text. A _registry_ of short ids has the same effect as B with an
extra indirection to keep in step, and the ledger it would need is per-pack,
which is the very thing that cannot arbitrate between packs.

**Recommendation: B, narrowed.** Always qualify in the two places a link is
generated _for a person to keep_ — a passage route and a skill filter — and
nowhere else. It is the only option where the address of a piece of content does
not depend on what else is installed, which is the property that actually matters
when packs are add-ons. Take the ugliness; it is one segment. But that is a
recommendation, not the finding: whoever picks this up should confirm it in this
file, or say why not, before writing code.

### Decided, 2026-08-26

**D, narrowed — and B is deferred rather than rejected.** The two briefs
recommended different things, and the reason is that they were each looking at
half of the problem. Naming the halves is the decision:

- **Across languages**, a bare local id is already unambiguous _in context_: the
  path carries the language, so `/de/a1/read/700001` cannot mean the Spanish
  passage. This half is free, and it is the half a second language **guarantees**
  — two packs from one generator both number their passages from `700001`.
- **Within one language**, the course cannot disambiguate anything, because both
  packs are in it. Only a qualified spelling can, which is
  `pack-addressing.md`'s B.

So: the course's packs narrow resolution where a caller means "in this course",
and `validateAcrossPacks` keeps being a **wall for the same-language case** —
narrowed to compare within a target language, which is what it was actually
protecting. `core-es` + `core-de` loads. `core-es` + `extra-es` still fails
loudly, at build time, naming the local ids both packs claim.

**Why B is not done now.** It costs every link today — `?skill=core-es:preterite`
in place of `?skill=preterite` — for a case that does not exist: there is no
second Spanish pack, and `session-url.ts`'s reason for the bare form
("a shared link should not carry a pack namespace it will outlive") is still
good. Half of B is in place regardless and always was: `resolveRef` **accepts** a
qualified ref and resolves it exactly. What B would change is what the app
_generates_, and that is a link-spelling decision better made with the real
second-Spanish-pack case in hand than guessed at now. The wall is what buys the
time: nobody can ship the ambiguity while it stands.

**Scoping is opt-in per call site, and that is the narrowing.** The repository
stays course-blind — "a lexeme lookup should not care which pack it came from" is
still right — so the optional pack scope is a parameter the callers that already
hold a course pass in. It is deliberately **not** passed everywhere:

- **Passed** where the caller means "within this course": a mission's passage and
  its transfers, `?passage=` and `?skill=` on a session link, and the passage
  route. A ref that names nothing in scope resolves to `missing` rather than
  widening, because the caller asked a narrower question.
- **Not passed** by search. A focus is a bias and never a filter, and search
  deliberately shows content outside the current level — narrowing it here would
  turn the one screen that answers "where does this word appear" into one that
  answers it only partially.

Two things to weigh while deciding:

- **The id ranges are already partitioned by kind, not by pack.** Sentences take
  `1–499_999`, passages `700_001–799_999` and so on, per pack. So two packs
  authored independently will both start their passages at `700001`, which makes
  the collision the default rather than the exception. Any option that does not
  qualify has to solve this some other way — a range registry across packs, which
  is a coordination problem between pack authors and therefore not a solution.
- **`?skill=` is the one that hurts.** Skill local ids are English-ish words
  (`preterite`, `gustar-type`), so two Spanish packs colliding on them is close to
  certain, while passage ids colliding is merely likely.

## 4. Then: packs as actual add-ons

Independent of §3, and worth its own pass. Today the catalog is generated into
the build:

```json
{ "packs": [{ "id": "core-es", "manifest": "core-es/pack.json" }] }
```

So "installed packs" is a fiction — every pack ships with the app and Settings
lists what is bundled. Making a pack a real add-on needs, roughly in order:

1. **A pack source that is not the build.** `DatasetSource` is already the seam
   and `httpDatasetSource` already exists, so a pack served from elsewhere is a
   source change rather than an architecture change. The catalog becomes stored
   state rather than a generated file.
2. **Install and remove in Settings → Packs**, which already lists packs with
   their version, licence and provenance and counts what they hold.
3. **A cache story.** `globPatterns` precaches every `.jsonl`, which is right for
   bundled content and wrong for an add-on fetched later; that belongs in
   `runtimeCaching` beside the audio rule. Read
   [`docs/architecture.md`](../architecture.md#updates-and-caching) first — the
   `index.html`/`sw.js` no-store rule is load-bearing.
4. **What a learner sees when content they have practised goes away.** Progress
   references item ids that carry their pack, so history survives; but Progress
   would show mastery for words no loaded pack defines. Decide whether that reads
   as "retained, greyed out" or is filtered to the installed set. Do **not** solve
   it by deleting progress.
5. **Levels above A2 — settled, and it went the other way.** `CEFR_LEVELS`
   already runs to `c2` and `LevelScope` already has `all`; a B1 pack needs no
   engine change. The open question was whether B1 should be a separate pack or a
   level inside `core-es`, and this note said that if separate, §3 had to be
   settled first because both packs would want `preterite`.

   **B1 shipped as a level inside `core-es`** (pack `0.11.0`), precisely to avoid
   depending on §3, which is still open. Nothing here is invalidated: the
   reasoning stands for the _next_ pack, and this item is no longer the thing
   blocking content above A2 — that content exists.

   What the decision does change is the shape of the remaining question. It is no
   longer "how do we ship B1" but "when is a second pack worth the addressing
   work at all", and the honest answer after doing B1 this way is: not until a
   pack needs to be installable or removable, i.e. item 2 above. A level inside
   the bundled pack cost one build change — the file-name prefix is derived from
   the levels present, so `es-a1-a2-core-*` renamed itself — and no engine change
   whatsoever.

## 5. Definition of done

- [ ] The decision in §3 is written down here, with its reasoning
- [ ] `session-url.ts` and `read-url.ts` spell the chosen form in both directions
- [x] Two packs claiming one local id resolve unambiguously — `resolveRef`, with
      tests loading two fixtures that would previously have collided
- [ ] `readPath` and `sessionPath` emit the chosen form, so a link is portable
- [ ] An old-style link still resolves, or degrades to broader rather than empty
- [ ] `validateAcrossPacks` is relaxed to match whatever §3 makes legal, rather
      than left contradicting it
- [ ] `npm run check` passes; `npm run validate:data` reports 0 / 0

## 6. Verification

```bash
npm run check && npm run build
```

Then, in the running app: follow a link built before the change, a link built
after it, and a link to a passage id no pack has. All three must land somewhere
that says what happened.
