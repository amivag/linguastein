# Task: fetch only the shards the course needs

**Status:** **done 2026-08-28.** All three steps landed; §7's manual pass was run
against the dev server and matched. What is left of `language-matrix.md` §5 is
runtime caching, which was never this task
**Written:** 2026-08-26
**For:** a fresh agent session, no prior context assumed
**Scope:** `src/app/services.ts`, `src/app/course.ts`, `src/domain/content/course.ts`
and one new piece of React plumbing. No content, no build changes, no service
worker. The dataset already ships sharded and the loader already knows how to
skip.

---

## 0. What landed

Read this before the brief below, which is kept as written so the reasoning it
records stays legible.

- **A course is described by its packs, not by its contents.** `courseOptions`
  reads `manifest.levels` and `manifest.levelItems`; the ladder filter over loaded
  items is gone, and `itemsPerLevel` falls back to counting only for a pack that
  declares no figures — which is a pack loaded whole, so counting is right there.
- **Boot reads the address.** `parseCoursePath` is the inverse of `coursePath`, in
  the module that owns that spelling, and `services.ts` calls it before the
  router exists. A path naming no level — `/`, which is the commonest way in —
  falls back to `preferences.level`, because `/` is about to redirect there.
- **`loadPack` gained `only`**, the complement of `upTo`, for topping a pack up
  without re-reading the unsharded files; `LoadedPack` now carries the manifest
  path it came from and the shard levels it put in memory, which is the
  bookkeeping the widening needs. `shardLevelsFor` is exported because the app
  asks the same question one step later — the §5 trap, avoided by there being one
  function rather than two agreeing ones. It also widens a ceiling the pack does
  not declare to the whole pack: `levelsUpTo` yields nothing there deliberately,
  which is right everywhere `resolveCourse` has already corrected the level and
  wrong at boot, where nothing has.
- **`src/app/content.ts` is the widening**, chosen in `services.ts` like every
  other seam. `has` and `ensure`, one chained queue so a chip tapped during the
  prefetch waits on it instead of fetching the same shards again, and an `issues`
  list so validation problems in late shards still reach Settings.
- **The change signal is option A**, a revision and a `subscribe` on
  `ContentRepository`, read through `useSyncExternalStore` in `useCourse`. The
  memo problem §4 names is solved by making the courses themselves the snapshot,
  cached per revision in a `WeakMap` — stable between arrivals, which the hook
  requires, and new exactly once per arrival, which is what re-renders a screen.
- **`CourseContent` in `App.tsx`** gates the routes on the address's level and
  shows the boot loading state while a widening is in flight.

`tests/app/shard-loading.test.tsx` holds the whole of it against the real shipped
pack, `tests/data/level-shards.test.ts` the loader half, and
`tests/domain/course.test.ts` the description-without-content half.

Read [`AGENTS.md`](../../AGENTS.md) — **Architecture rules** 1 and 5, and
**Courses and the URL** — then [`language-matrix.md`](language-matrix.md) §5,
which this is the last step of.

---

## 1. Where this stands

`docs/tasks/language-matrix.md` §5 is four things. Three have landed:

- **Version in the path.** `packs/core-es/0.16.0/…`, and `catalog.json` carries
  the version. `loadPack` derives its root from the manifest path it is handed, so
  this needed no loader change at all.
- **Shard by level.** `sentences`, `forms` and `vocabulary` are one file per level.
  Each declares its `level` in the manifest, so a loader decides without opening
  the file. The other files — skills, lexemes, passages, translations — are small
  and unsharded, and translations _cannot_ be sharded: a translation references an
  item, a lexeme or a skill, so its level is a join rather than a field.
- **A partial pack is a valid pack.** `loadPack(source, path, { upTo })` fetches
  the shards at or below a ceiling plus everything unsharded, reports
  `partial: true`, and passes that to `validatePackIntegrity`, which then skips
  every _cross-record_ check and keeps every check one record can fail alone.
  Without that, a partial load reports 1,757 dangling translations and a broken
  passage per B1 text. `tests/data/level-shards.test.ts` holds it.

**The fourth is runtime caching, and it is not this task.** It needs a real
browser going offline, which the suite and the dev server do not exercise.

## 2. What is actually left, and why it is worth doing

`src/app/services.ts` calls `loadPacks` without `upTo`, so the app still fetches
every shard at boot. **Nothing has got faster yet.** The whole saving is one
argument away, and the work is making the app survive not having the rest.

The numbers, measured 2026-08-26:

|                          |                       |
| ------------------------ | --------------------- |
| Whole pack               | 6.3 MB                |
| What an A1 course needs  | **3.0 MB**            |
| `sentences` a1 / a2 / b1 | 1.76 / 1.12 / 0.79 MB |
| `forms` a1 / a2 / b1     | 0.52 / 1.01 / 0.26 MB |

## 3. Three steps, in this order

### 3.1 Describe a course without its content

`courseOptions` in `src/domain/content/course.ts` derives a course's levels from
the items **actually loaded**:

```ts
const present = ladder.filter((level) => items.some((item) => item.level === level));
```

With B1 unfetched that hides the B1 course entirely — the chip a learner would tap
to _get_ B1. It should read `manifest.levels`, which already lists only the levels
the pack has content for (the build derives `presentLevels` from emitted items),
so the filter is not merely replaceable, it is redundant.

The counts are the other half. A `CourseLevel.count` is cumulative — `A1 2059`,
`A2 3063`, `B1 3816` — and counting loaded items would report a _smaller course_
rather than an unfetched one. The manifest carries `levelItems` for exactly this:
exact per level (`{ a1: 2059, a2: 1004, b1: 753 }`), because a ceiling is the
app's arithmetic and the ladder is in the manifest beside it.

Do this step first and on its own: it is pure, it is testable without touching
loading at all, and everything after it depends on the chips being right.

### 3.2 Boot to the ceiling, then prefetch the rest

`services.ts` needs the ceiling before it loads. It comes from the URL —
`/es/a1/…` — and `services.ts` runs before the router, so read
`location.pathname`. That is grubbier than it looks elsewhere in this codebase;
consider whether `resolveCourse` can be reached with a path rather than params, or
accept it with a comment naming why.

Then fetch the rest in the background and `repository.add` them. Not because the
learner will need them — they may not — but because a level chip should be instant
when they do.

### 3.3 Await a widening that has not arrived

A level chip tapped before the prefetch lands has to wait. Show the loading state
the app already has for boot.

**Not a reload**, and this was decided rather than assumed: the level chips sit in
`CourseBar` on most screens and are tapped often, so a full navigation there would
trade a frequent interaction to save work in one place. A **language** switch may
reload — it is rare, it is a different pack, and it is unreachable today because
`CourseBar` hides the language picker when only one pack is loaded.

Note the asymmetry: **narrowing never needs a fetch.** Only a rising ceiling does,
and `all` needs everything.

## 4. The one piece of machinery

Steps 3.2 and 3.3 both need a **change signal**: `ContentRepository` grows content
after the first render, and nothing re-renders today. `services.ts` builds the
repository once and hands it through `ServicesContext`, whose identity never
changes.

Two shapes worth weighing before writing either:

- **A version counter on the repository** plus `subscribe`, read through
  `useSyncExternalStore`. Keeps the knowledge in the thing that changes, and works
  for any future incremental load. Costs a subscription API on a class that
  currently has none.
- **React state in the services provider** holding which levels are loaded. Much
  smaller, and it re-renders the whole tree — which is what you want here anyway,
  since new content can affect any screen. But it puts the fact in a second place
  and the repository can then be mutated without anyone noticing.

Note `useCourse` memoises `courseOptions` on `services.repository` identity, so
whichever is chosen has to invalidate that too.

## 5. Traps

- **`courseFilter` and `loadPack` must agree.** Both use `levelsUpTo`; keep it
  that way. Two answers to "is this level in scope" is one too many, and the
  symptom is a session planned over items that were never fetched.
- **`validateAcrossPacks` runs in `loadPacks`, not `loadPack`.** It compares local
  ids within a target language and does not care about partial loads, but check it
  again if the background load calls it a second time.
- **The `all` scope must mean the whole pack.** It is what `resolveCourse`
  degrades a stale level to, so it cannot resolve to an empty fetch.
- **A record with no level would vanish.** The build already refuses one — the
  shards are a filter, not a partition, so a level outside the ladder would be
  written to no file. Do not remove that check.
- **`npm run check` builds after it tests**, so a test cannot read `dist`. Assert
  against `public/packs` and the loader, as `level-shards.test.ts` does.

## 6. Definition of done

- [x] A cold load of `/es/a1` fetches the a1 shards and no others — assert on the
      paths a `DatasetSource` was asked for, the way `level-shards.test.ts` does
- [x] The level chips show every level the pack declares, with its real count,
      before any of that level is loaded
- [x] Tapping B1 shows B1 content — after a wait if the prefetch has not landed,
      immediately if it has
- [x] Narrowing to A1 fetches nothing
- [x] A screen open when late shards arrive shows them without a navigation
- [x] `npm run check` passes; the app loads with no console errors

## 7. Verification

```bash
npm run check
```

Then in the running app, with the network panel open: load `/es/a1` and count the
`.jsonl` requests — three shards plus the unsharded files, ~3.0 MB rather than
6.3. Tap B1 and watch the rest arrive. Reload on `/es/all` and confirm every shard
is fetched.

**Run 2026-08-28**, and it matched: `/es/a1/browse` fetched `forms-a1`,
`vocabulary-a1` and `sentences-a1` plus the five unsharded files, then the six
a2/b1 shards arrived behind the rendered screen. The chips read `A1 2059`,
`A2 3063`, `B1 3816`, `All levels 3816` with only A1 loaded. `/es/b1` fetched all
nine at boot. Every file is requested twice in dev — that is StrictMode
double-invoking the boot effect, and it predates this change.
