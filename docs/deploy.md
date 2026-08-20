# Deploying

The app is a static bundle — a Vite build, an IndexedDB store, no server and no
account — so hosting it is free. It is served by GitHub Pages from this
repository, at:

    https://amivag.github.io/linguastein/

A push to `main` runs [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml),
which checks, builds, and uploads `dist/` as a Pages artifact. About a minute.

## The one setting that matters

In the repository's **Settings → Pages**, Source must be **GitHub Actions** — not
"Deploy from a branch".

This is not a preference. With `Source: GitHub Actions`, Pages serves only the
artifact the workflow uploads. With "Deploy from a branch" it serves the
repository tree, which means `index.html` at the repository root gets served
verbatim — the unbuilt one, whose entry point is `/src/main.tsx`. The result is a
blank page and every source file readable over HTTP:

```text
https://amivag.github.io/linguastein/src/main.tsx     200
https://amivag.github.io/linguastein/vite.config.ts   200
```

That happened once. If the site ever goes blank and view-source shows
`src="/src/main.tsx"`, this setting is why.

## Why a subpath, and what pays for it

A project page is served under `/<repo>/`, not at the domain root — only a repo
named `amivag.github.io` gets the root, and that one is kept free for a landing
page across several apps.

So the subpath has to be threaded through the build. It is declared once, as
`BASE` in [`vite.config.ts`](../vite.config.ts), and reaches four places:

| Consumer                     | How                                                          |
| ---------------------------- | ------------------------------------------------------------ |
| Asset URLs in the built HTML | Vite's `base`, which rewrites them                           |
| Router                       | `basename={import.meta.env.BASE_URL}` in `src/app/App.tsx`   |
| PWA manifest                 | `start_url`, `scope` and both icon `src` paths               |
| Dataset fetches              | `${import.meta.env.BASE_URL}packs/` in `src/app/services.ts` |

`BASE` applies in development too, so the dev server serves at
`http://localhost:5173/linguastein/` rather than the root. That is deliberate: a
base-path mistake then shows up locally instead of only after a deploy.

**One consequence of subpath hosting worth remembering:** `amivag.github.io` is a
single browser origin, so every app hosted there shares one IndexedDB,
localStorage and Cache namespace. This app namespaces its store as `linguastein`
and its theme key as `linguastein.theme`. A second app must do likewise, or the
two will collide.

## Known rough edges

- **Deep links return HTTP 404.** Pages has no rewrite rule, so the workflow
  copies `index.html` to `404.html` and the router renders the right screen from
  it. The page is correct; the status code is not. Immaterial while the app is
  `noindex`.
- **No response headers.** `X-Robots-Tag`, CSP and cache-control cannot be set on
  Pages. The crawler opt-outs live in a `<meta>` tag and
  [`robots.txt`](../public/robots.txt) instead.
- **Nothing gates the site.** Free Pages cannot be access-controlled; private
  Pages needs GitHub Pro. The URL is public from the first deploy.

## On the source being public

The repository is public, which is what allows free Pages to serve it at all.
That is a trade with eyes open: no licence prevents a scraper from feeding public
source into a training corpus, the `robots.txt` and `<meta>` opt-outs are honoured
only by crawlers that choose to, and there is no technical control left once the
code is public.

What it buys, besides free hosting: AGPL §13 is satisfied without further effort.
The licence asks that people who use the app over a network be able to reach its
Corresponding Source, and now they can.

The alternative, if that trade ever stops looking good, is a private repository
with the build published to a separate public one — free, but it needs a
cross-repository token. It was set up that way once and the history has the
working version.

## Testing a change

Push to `main`, wait about a minute, open the URL. The service worker uses
`registerType: 'autoUpdate'`, so a second visit picks up the new build — see
[architecture.md](architecture.md#updates-and-caching) for what that means for a
session in progress.

To test without publishing, the dev server is reachable across your own network,
at `/linguastein/` on the printed address:

```bash
npm run dev -- --host
```

Sourcemaps are on, so a problem that only reproduces on a phone can be read
directly in devtools against the deployed build.
