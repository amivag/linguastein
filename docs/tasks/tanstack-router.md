# Task: move the routing layer to TanStack Router

**Status:** briefed, not started
**Written:** 2026-08-24
**For:** a fresh agent session, no prior context assumed
**Scope:** the routing layer and the test harness that mounts screens. No screen
behaviour changes, no URL changes, no engine changes. Every address the app
answers today must answer identically afterwards.

Read [`AGENTS.md`](../../AGENTS.md) first — **Courses and the URL**, **Browse's
URL, and the filter spelling**, and architecture rule 5 (_no vendor above a
seam_). This task is mostly an application of that rule.

Verified against `@tanstack/react-router` **1.170.29** on 2026-08-24 by reading
the published sources rather than the docs. Statements marked _(verified)_ were
checked in `dist/esm/*.js` of that version.

---

## 1. Why do this at all, and what the real prize is

React Router 7 is not broken and nothing here is urgent. Two things make the move
worth scheduling anyway.

The first is the stated one: not being stranded on an aging router before the
routing layer grows. The second is bigger, and is why this task is worth more
than the version bump it looks like.

**The router is the last vendor in this codebase with no seam.** TTS, speech
recognition, storage, the dataset source, AI and the icon set all sit behind
interfaces chosen once — architecture rule 5, enforced by `.oxlintrc.json`.
`react-router` is named directly in **18 files under `src/`** and **15 under
`tests/`**. That is why this migration is measured in days rather than the hour
React Router 8 would cost: not because TanStack is hard, but because there is no
seam to swap.

So do it in the shape that leaves a seam behind. The next router change — and
there will be one — should cost one file.

## 2. What is actually being used

The whole surface, across 33 files:

| API                              | Sites                | Notes                                                                       |
| -------------------------------- | -------------------- | --------------------------------------------------------------------------- |
| `useNavigate`                    | 22 imports, 27 calls | Every call takes a **string** built by a path codec. One takes `-1`.        |
| `useLocation`                    | 27 (8 in `src`)      | `pathname` and `search`; in tests, a probe asserting the resulting address. |
| `<Link to>`                      | 11                   | Also a codec-built string.                                                  |
| `useSearchParams`                | 10                   | Read as `URLSearchParams`; one call site writes.                            |
| `useParams`                      | 8                    | `language` / `level` in `useCourse`, plus `id`, `missionId`, `stage`.       |
| `<Navigate>`                     | 1                    | `CourseRedirect`.                                                           |
| `BrowserRouter` / `MemoryRouter` | 1 each               | `src/app/App.tsx`; `tests/fixtures/services.tsx`.                           |

The important property, and the one that makes this tractable: **not one call
site spells a URL itself.** Every path comes out of `coursePath`, `sessionPath`,
`studyPath`, `browsePath`, `missionPath` or `readPath`, and every query string is
parsed by a pure function over `URLSearchParams`. That is ~560 lines of
router-agnostic codec (`src/features/*/*-url.ts`; `session-url.ts` alone is 258)
and it is an asset here, not an obstacle: the codecs already are the seam for
_addresses_. What is missing is a seam for _navigation_.

## 3. The three real incompatibilities

Everything else is mechanical. These three are decisions.

### 3.1 `to` is type-checked against the route tree; our paths are strings

TanStack's selling point is that `to` is a literal checked against the route
tree, with `params` supplied separately. Our paths arrive as
`/es/a1/browse?type=word&sort=az` — one opaque string, computed at runtime.

For **`navigate`** there is a clean answer: `NavigateOptions` carries
`href?: string`, and for a root-relative string it is an ordinary client-side
navigation _(verified)_ — `router.navigate` tries `new URL(href)`, which throws
for a relative path, so `hrefIsUrl` stays false, `reloadDocument` is not forced,
and it falls through to `buildAndCommitLocation`, which splits the href into
pathname, search and hash. Only an **absolute** URL triggers a document load. So
all 27 `navigate(path)` calls become `navigate({ href: path })` with the codecs
untouched.

For **`<Link>`** that escape hatch does _not_ work, and this is the trap worth
knowing before starting _(verified)_: `useLinkProps` never destructures `href`,
so it lands in `propsSafeToSpread` — but the router's own computed `href` is
applied _after_ the spread and wins, and it is computed from `to`, which is
`undefined`, which resolves to **the current location**. The click handler passes
the whole options object to `router.navigate`, so clicking works; the rendered
`<a href>` points at the page you are already on. Middle-click, copy-link,
open-in-new-tab and "where does this go" all break silently. `_options` is also
memoised on deps that exclude `href`, so it goes stale.

A `<Link>` therefore needs `to` plus `search`. Split the codec's output once:

```tsx
// src/app/navigation.tsx — the seam. The only file that names the router.
export function AppLink({ to, ...rest }: { to: string } & LinkRest) {
  const [pathname, query] = splitHref(to);
  // `to` is a concrete pathname, not a route pattern: at runtime TanStack
  // matches it against `/$language/$level/browse` and interpolates nothing,
  // because there is nothing left to interpolate. Only the *type* objects.
  return <Link to={pathname as never} search={Object.fromEntries(query)} {...rest} />;
}
```

The cast is the price of keeping runtime-computed addresses, and it is paid in
one file rather than eleven. That is the same trade `components/icons.ts` makes.

### 3.2 Search params are an object, and TanStack owns the serialisation

TanStack parses the query string into an object and re-serialises it on every
navigation _(verified)_: `buildAndCommitLocation` runs `parseSearch(parsed.search)`
and `buildLocation` runs `stringifySearch(nextSearch)`. With the default
serialiser that means JSON coercion — `?size=20` becomes the number `20` — and no
guarantee the string comes back out byte-identical.

Do **not** adopt `validateSearch`. The codecs deliberately _drop_ unrecognised
values rather than reject them, so a stale link degrades instead of erroring;
`validateSearch` throws. Two router options make the codecs authoritative
instead, both first-class:

```ts
createRouter({
  parseSearch: (str) => Object.fromEntries(new URLSearchParams(str)),
  stringifySearch: (obj) => {
    const s = new URLSearchParams(obj as Record<string, string>).toString();
    return s ? `?${s}` : '';
  },
});
```

This is lossless **only because no query key ever repeats** — the codecs use
comma-joined lists (`?pos=verb,noun`), and there is no `append` or `getAll` on a
search param anywhere in `src`. Verified today; keep it that way, or this
identity pair silently drops values.

Reading then needs no object at all. `ParsedLocation` carries `searchStr: string`
_(verified)_, so the existing reads become a three-line shim and the ten call
sites do not change:

```ts
export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(useLocation({ select: (l) => l.searchStr }));
}
```

### 3.3 The test harness mounts screens with no route

This is the largest single piece of work and it is invisible until you try it.

`tests/fixtures/services.tsx` wraps the component under test in
`<MemoryRouter initialEntries={[route]}>`. React Router is happy to render
`<BrowseScreen />` under a router with **no matching route** — the hooks still
work and `useParams` simply returns nothing. TanStack has no such mode: hooks
read from a matched route, and there must be a route tree.

The numbers: **206 `renderWithServices` calls** across 15 files, **155** with an
explicit `route:` and **51** relying on the default `/`. Seven test files build
their own inline `<Routes>` trees (`courses.test.tsx`'s `courseRoutes()` helper is
the pattern), and eight mount a `useLocation` probe to assert the resulting
address.

The good news is that one file is the choke point. Give the fixture a synthesised
router: the app's real path patterns, every route rendering the injected `ui`.
Then `renderWithServices(<BrowseScreen />, { route: '/es/a1/browse' })` keeps
working unchanged — params still come from the path, which is the whole point of
`courses.test.tsx` — and the bare calls land on the root route.

```tsx
// tests/fixtures/services.tsx, sketch
function testRouter(ui: ReactNode, at: string) {
  const root = createRootRoute({ component: () => <>{ui}</> });
  const routes = APP_ROUTE_PATHS.map((path) =>
    createRoute({ getParentRoute: () => root, path, component: () => <>{ui}</> }),
  );
  return createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [at] }),
    ...SEARCH_SERIALISERS,
  });
}
```

Export `APP_ROUTE_PATHS` from the route module so the fixture cannot drift from
the app — a test tree that has diverged from the real one is worse than no test.
The seven files with inline `<Routes>` then pass a path list rather than JSX, and
the `useLocation` probes change their import only.

## 4. Everything else, which is mechanical

- **`BrowserRouter basename`** → `createRouter({ basepath: import.meta.env.BASE_URL })`.
- **The router instance** is created once at module scope, but `CourseRedirect`
  needs `useServices()` to resolve where `/` goes, and services are created
  asynchronously during boot. Do not move that into `beforeLoad` — it runs
  outside React and cannot read context. `RouterProvider` accepts
  `context?: Partial<…>` _(verified)_, which is exactly the inject-after-boot
  hook: create the router at module scope with an empty context, and pass
  `context={{ services, preferences }}` from `App` once `boot.phase === 'ready'`.
  Keep the existing `<Navigate>`-style redirect components; they work, and they
  keep the redirect logic where it is readable.
- **`useParams()` in `useCourse`** → `useParams({ strict: false })`, the loose
  form that returns partial params. `useCourse` is deliberately rendered outside
  the course routes in tests and must keep resolving to the widest real course,
  so the loose form is required, not a convenience.
- **The two 404 routes** map cleanly. `/:language/:level/*` becomes a `$` splat
  route (the param is `_splat`, also exposed as `*` _(verified)_) and the global
  `*` becomes the root route's `notFoundComponent`. The intent recorded in
  `AGENTS.md` — a 404 that keeps the course it was reached from, matched before
  the global one — survives intact, and arguably reads better as a per-route
  `notFoundComponent`.
- **`navigate(-1)`** in `AppShell` → `useRouter().history.back()`. There is also
  `useCanGoBack()`, which would let a Back control hide itself when there is no
  history — a small improvement, and out of scope here.
- **`/design`'s `lazy` + `Suspense`** can stay as it is. TanStack has
  `lazyRouteComponent`, but React's own lazy still works and the split is already
  correct.
- **`.oxlintrc.json`**: add `@tanstack/react-router` to the vendor list in the
  engine block so the engine still cannot import it, and — the point of section 1
  — add a seam block banning the vendor everywhere under `src/`, then clear it for
  `src/app/navigation.tsx` in a later block, exactly as `src/components/icons.ts`
  is handled today. Mind the last-block-wins note at the top of that file: the
  exemption has to come after the ban, not inside it.
- **Scroll restoration** comes free and is currently absent. Do not enable it in
  the same change; it is a behaviour change and belongs in its own commit.

## 5. What it costs

Measured on 2026-08-24 with esbuild, identical flags, importing the API surface
this app actually uses, React externalised:

| Package                           | Minified | Gzip    |
| --------------------------------- | -------- | ------- |
| `react-router` 8.3.0              | 43.2 KB  | 15.4 KB |
| `@tanstack/react-router` 1.170.29 | 84.1 KB  | 29.3 KB |

For context, attributing the shipped bundle's sourcemap by package:
`react-router` is **37 KB of 574 KB minified (6.4%)** today, inside a single
177 KB gzip entry chunk. So expect roughly **+14 KB gzip, about +8%** on the
entry chunk. It also adds four transitive dependencies (`router-core`,
`history`, `react-store`, `isbot`) where react-router had none.

That is a real cost for a mobile-first, offline-precached PWA and it should be
stated plainly rather than discovered later. It is not a reason not to do it —
+14 KB gzip is one small photograph — but it means this migration cannot be
justified on weight, only on maintenance and on the seam.

## 6. Order of work

Each step ends with `npm run check` green. Do not batch them.

1. **The seam, still on React Router.** Create `src/app/navigation.tsx` exporting
   `useSearchParams`, `useAppNavigate`, `AppLink`, `useBack` and
   `useCourseParams`, implemented over `react-router`. Move all 18 `src/` files
   onto it. Add the seam block to `.oxlintrc.json`. This commit changes no
   behaviour and lands on its own merit — after it, the router is behind a seam whichever destination
   is chosen.
2. **The route tree.** Extract the 15 routes from `App.tsx` into
   `src/app/routes.tsx`, exporting `APP_ROUTE_PATHS` for the fixture. Still
   React Router.
3. **The test fixture.** Give `renderWithServices` the synthesised-router shape
   from §3.3 while still on `MemoryRouter`, and convert the seven inline
   `<Routes>` files to it. This step de-risks everything after it: if 206 render
   calls survive a fixture rewrite on the router they already work with, the swap
   itself is small.
4. **Install and swap.** `@tanstack/react-router`, the search serialisers, the
   route tree, `RouterProvider` with injected context, and the seam's five
   functions reimplemented. In principle nothing outside `navigation.tsx`,
   `routes.tsx`, `App.tsx` and the fixture changes — the `AppLink` cast in §3.1
   is what buys that.
5. **Verify the addresses, not the components.** Every legacy redirect
   (`/session?…`, `/read/700001`), both 404 routes, the `?from=` provenance
   round-trip, and a query string that survives a level switch. Then check the
   byte-stability of the query string against §3.2 — this is where the identity
   serialisers earn their place.
6. **Remove `react-router`** and confirm the built bundle against §5.

## 7. Two decisions taken here, so they are not re-litigated

**Code-based route tree, not file-based.** File-based routing is TanStack's
default recommendation and the wrong fit here: it needs `@tanstack/router-plugin`
in `vite.config.ts`, it generates a `routeTree.gen.ts` that would need
Prettier, ESLint and coverage exclusions, and it would scatter across
`src/features/` a route table that is currently 15 legible lines in the
composition root. `src/app/` exists to hold exactly this. Fifteen routes is not
a filesystem's problem to solve.

**No `validateSearch`, ever, unless the codecs go with it.** Stated in §3.2 and
repeated here because it is the change a future agent will be most tempted to
make: TanStack's typed search looks like an upgrade over parsing
`URLSearchParams` by hand. It is not, for this app. The codecs' contract is that
an unrecognised value is dropped and the screen still opens; `validateSearch`
throws. Adopting it would turn every stale bookmark into an error page.

## 8. Two things that will bite

**The repo's npm is pinned to `min-release-age = 7`** (in `~/.npmrc`), so
`npm i @tanstack/react-router` resolves to the newest release at least a week old
— 1.170.29 on 2026-08-24, not the 1.170.32 that `npm view` reports as latest.
TanStack ships very frequently. Expect the installed version never to be the
newest, and do not fight it: that setting is supply-chain hygiene and worth more
than a patch release.

**Do not take TypeScript 7 along for the ride.** It is out (7.0.2) and tempting
while touching types, but it would take `npm run lint` down with it, and the gate
is the thing that makes this migration safe.

This is worth understanding rather than just avoiding, because "wait for a newer
typescript-eslint" is the wrong model of the wait. TypeScript 7 is the native
port: `typescript@7.0.2` ships per-platform Go binaries and its root export is
`./lib/version.cjs`, with the JS surface reduced to `./unstable/ast`,
`./unstable/sync`, `./unstable/async` and `./unstable/proto`. The
`lib/typescript.js` compiler API that typescript-eslint's type-aware rules are
built on — `ts.createProgram`, `TypeChecker` — is simply not there any more.
Which is why both `typescript-eslint@8.67.0` and its canary
(`8.67.1-alpha.29`) still declare `typescript: >=4.8.4 <6.1.0`, and why there is
no v9 line: it is a re-plumbing onto an API still marked unstable, not a peer
range someone forgot to widen.

The path forward is **TypeScript 6**, not 7. `typescript@6.0.0-beta` still ships
`main: ./lib/typescript.js`, and typescript-eslint's `<6.1.0` ceiling is drawn to
include it. When 6.0 goes stable it should be an ordinary bump.

Since 2026-08-24 the ceiling is narrower than it was, and worth knowing exactly.
Linting moved to oxlint for everything except the React rules, so
`typescript-eslint`'s meta package is gone. What still pins TypeScript is
`@typescript-eslint/parser`, kept only so ESLint can read `.tsx` for
`react-hooks` v7 — oxlint implements two of that plugin's sixteen rules, and the
fourteen missing ones are the React Compiler set. So the pin now has a single
cause with a single fix: the day oxlint ports those rules, `eslint.config.js` and
its parser both go, and nothing in the toolchain needs the TypeScript JS API any
more. If that day comes before TS 6 ships, `oxlint-tsgolint` is the type-aware
piece to look at.
