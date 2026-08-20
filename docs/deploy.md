# Deploying

The app is a static bundle — a Vite build, an IndexedDB store, no server and no
account — so hosting it costs nothing anywhere that serves files. Two constraints
decide the shape of the setup:

1. **The source stays private.** No licence prevents a scraper from feeding source
   into a training corpus; this project's AGPL included. Privacy is the control,
   and the licence only governs the people we hand the code to deliberately. That
   rules out free GitHub Pages served straight from this repository, which requires
   the repository to be public.
2. **Free, with no new accounts.** GitHub only.

## The shape

Two repositories:

```text
  linguastein  (private)  ──build──▶  amivag.github.io  (public)
  source, history, issues             the current bundle, nothing else
```

A push to `main` runs [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml),
which builds the app and force-pushes `dist/` to the public repository. Only
minified output and the CC BY-SA datasets are ever public — no TypeScript, no
history, no sourcemaps.

**The public repository must be named `amivag.github.io`.** That is not cosmetic:
a GitHub user site is served at the domain root, whereas any other repository is
served under `/<repo>/`. The PWA manifest declares `start_url: '/'` and
`scope: '/'` and the router runs without a basename, so root serving keeps the
install and offline behaviour working with no code changes. A subpath would need
all three altered plus a base path threaded through the build.

## One-time setup

Steps 1–3 need your GitHub account, so they are yours to do.

**1. Create the private source repository and push.** On GitHub, new repository →
name `linguastein` → **Private** → add nothing (this repository already has a
README, licences and `.gitignore`).

```bash
git remote add origin git@github.com:amivag/linguastein.git
```

```bash
git push -u origin main
```

**2. Create the public output repository.** New repository → name it exactly
`amivag.github.io` → **Public** → completely empty, no README. Do not commit
anything to it by hand; the workflow force-pushes over whatever is there. Pages
serves a user site from the default branch automatically, so there is no Pages
setting to switch on.

**3. Give the workflow permission to push to it.** The default `GITHUB_TOKEN`
cannot reach another repository, so it needs a credential of its own. Settings →
Developer settings → **Fine-grained tokens** → generate one with:

| Field             | Value                         |
| ----------------- | ----------------------------- |
| Repository access | Only `amivag.github.io`       |
| Permissions       | Contents → **Read and write** |

Then add it to the **private** repository under Settings → Secrets and variables
→ Actions → new secret named `PAGES_DEPLOY_TOKEN`.

Fine-grained tokens expire. When it does, the deploy fails and the live site
silently stays on the last build, so either set a calendar reminder or use a
**deploy key** instead — an SSH key added to the public repository with write
access, which does not expire and cannot be scoped any wider than that one
repository.

## What is already in place

| File                                                              | Why                                                             |
| ----------------------------------------------------------------- | --------------------------------------------------------------- |
| [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) | Checks, builds, publishes on every push to `main`               |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)         | The same checks on pull requests                                |
| [`public/robots.txt`](../public/robots.txt)                       | Crawl and training opt-outs, including the named AI tokens      |
| [`index.html`](../index.html)                                     | `<meta name="robots">`, since Pages cannot set response headers |
| [`.nvmrc`](../.nvmrc)                                             | One Node version for both workflows and for local `nvm`         |

The deploy workflow runs `npm run check` before building, duplicating CI on a push
to `main`. That is deliberate: nothing else stands between a bad commit and the
live site. If the double run becomes annoying, drop `push: branches: [main]` from
`ci.yml` rather than weakening the gate in `deploy.yml`.

## Known rough edges

- **Deep links return HTTP 404.** Pages has no rewrite rule, so the workflow
  copies `index.html` to `404.html`; the router then renders the right screen. The
  page works, but the status code is wrong. Irrelevant while the app is `noindex`.
- **No response headers.** `X-Robots-Tag`, CSP and cache-control are unavailable
  on Pages. The crawler opt-outs moved into a meta tag; the rest is not currently
  set.
- **The site is publicly reachable.** Nothing gates it. That is consistent with
  the goal — a deployed site never exposes source — but treat the URL as public
  from the moment the first deploy lands.

## One obligation to note

The code is AGPL-3.0-only, and AGPL §13 covers software people use over a network:
whoever interacts with a modified copy remotely should be offered its Corresponding
Source. Serving the app publicly while the source repository stays private sits
awkwardly against that.

As sole copyright holder you are not bound by your own licence, so nothing is being
breached — but the honest resolutions are worth knowing, because the awkwardness is
real and it grows the moment the app has actual users:

- Add a source link, or an offer of source on request, in Settings beside the
  version string. Cheapest, and enough for an alpha.
- Make the source repository public, accepting the scraping exposure.
- State that the hosted build is offered under the copyright holder's reserved
  rights rather than under the AGPL.

Nothing is required today. Decide it before the app has users who are not you.

## Testing a change

Push to `main`, wait about a minute for the workflow, then open
`https://amivag.github.io/` on a phone. The service worker uses
`registerType: 'autoUpdate'`, so a second visit picks up the new build — see
[architecture.md](architecture.md#updates-and-caching) for what that means for a
session in progress.

To test without publishing, the dev server is reachable across your own network:

```bash
npm run dev -- --host
```

Sourcemaps are off in production ([`vite.config.ts`](../vite.config.ts)), so the
deployed bundle does not carry the original TypeScript. To debug a production
build, reproduce it locally:

```bash
npm run build && npm run preview
```
