# Deploying

The app is a static bundle — a Vite build, an IndexedDB store, no server and no
account — so hosting it costs nothing anywhere that serves files. The choice of
host is therefore decided by something else: the repository is private, because no
licence — this project's AGPL included — stops a scraper from feeding the source
into a training corpus. Privacy is the control; the licence only governs the
people we hand it to deliberately. That rules out the obvious free option and
settles the rest of the setup.

## Why Cloudflare Pages

- **GitHub Pages** is free only from a **public** repository. Public GitHub code
  is scraped at scale and has gone into published training corpora, with no
  opt-out — so a public repository gives away exactly what we set out to keep.
- **Netlify** deploys from a private repository on the free tier, but its
  password protection is a paid feature, so the deployed site stays open.
- **Cloudflare Pages** deploys from a private repository for free, and Cloudflare
  Access (free for up to 50 users) puts an email one-time-code in front of the
  site. Nothing is publicly reachable, so nothing is crawlable.

Pages also serves at the domain root, which matters more than it looks: the PWA
manifest declares `start_url: '/'` and `scope: '/'`, and the router runs without
a basename. A subpath host — `example.github.io/linguastein/` — would need all
three changed, plus a `404.html` fallback, and would still install as a
scope-limited PWA. Root serving keeps the offline and install behaviour intact.

## One-time setup

Steps 1 and 3 have to be done by hand — they need your GitHub and Cloudflare
accounts.

**1. Create the private repository and push.** On GitHub, new repository →
**Private** → do not add a README, licence or `.gitignore` (the repository
already has them). Then:

```bash
git remote add origin git@github.com:<you>/linguastein.git
```

```bash
git push -u origin main
```

**2. What is already in the repository.** Nothing to do here; listed so the
moving parts are visible.

| File                                                      | Why                                                                  |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| [`public/_redirects`](../public/_redirects)               | SPA fallback, so a hard refresh on `/practice` does not 404          |
| [`public/_headers`](../public/_headers)                   | `X-Robots-Tag: noindex, …, noai` on every response                   |
| [`public/robots.txt`](../public/robots.txt)               | Crawl and training opt-outs, including the named AI tokens           |
| [`.nvmrc`](../.nvmrc)                                     | Pins Node for Cloudflare's builder; `package.json` requires >= 22.13 |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Type-check, lint, format, coverage floors, dataset validation, build |

CI and the deploy are independent: GitHub Actions runs the checks, Cloudflare
builds and publishes. A red CI run does not block a deploy, so read the checks
before trusting a preview URL.

**3. Connect Cloudflare Pages.** Cloudflare dashboard → **Workers & Pages** →
**Create** → **Pages** → **Connect to Git** → pick the repository, then:

| Setting           | Value           |
| ----------------- | --------------- |
| Framework preset  | None            |
| Build command     | `npm run build` |
| Build output      | `dist`          |
| Production branch | `main`          |

`npm run build` runs `tsc -b` first, so a type error fails the deploy rather
than shipping. Every push to `main` republishes production; every other branch
and pull request gets its own preview URL.

**4. Gate it.** Two policies, because they are configured in different places
and it is easy to protect only the first:

- Production: Cloudflare **Zero Trust** → **Access** → **Applications** → add
  the Pages domain, policy **Allow** → include **Emails** → your address.
- Previews: the Pages project's **Settings** → **General** → enable the access
  policy for preview deployments. Without this, every branch push publishes an
  ungated URL.

Optionally, on a custom domain, turn on **Security** → **Bots** → block AI
scrapers and crawlers. Behind Access it is redundant; it is the backstop if
Access is ever removed.

## One obligation to remember

The code is AGPL-3.0-only, and AGPL §13 applies to software people use over a
network: anyone who interacts with a modified Linguastein remotely must be offered
its Corresponding Source. While the deployment is gated to you alone, there is
nobody to offer it to. **The moment you invite someone through Access, or open the
site up, the app owes its users a link to the source** — a line in Settings next to
the version string is the usual way. That is a deliberate to-do, not an oversight,
and it is waiting on the repository having a URL to point at.

## Testing a change

Push the branch, open the preview URL on a phone, sign in with the one-time code.
The service worker uses `registerType: 'autoUpdate'`, so a second visit picks up
the new build — see [architecture.md](architecture.md#updates-and-caching) for what
that means for a session in progress.

Sourcemaps are off in production ([`vite.config.ts`](../vite.config.ts)) so the
deployed bundle does not carry the original TypeScript. To debug a production
build, reproduce it locally:

```bash
npm run build && npm run preview
```
