# Task: pay for the app without spoiling it

**Status:** briefed as a set of decisions, not as work. The first step (§4) is
half a day; everything after it should wait for an audience that does not exist
yet.
**Written:** 2026-08-24
**For:** a fresh agent session, no prior context assumed
**Scope:** what the app may ask money for, and what it must never do to get it.

Read [`AGENTS.md`](../../AGENTS.md) and
[design-language.md](../design-language.md) first. The constraints below are not
squeamishness — several of them are enforced by tests that read the stylesheets,
and a change that breaks one fails `npm run check`.

Claims marked _(verified)_ were checked against this tree on 2026-08-24.

---

## 1. What the product currently promises

From the README, and true today _(verified)_:

> **See it, hear it, repeat it, reveal it, review it** — in two minutes, on a
> phone, offline, with no account.

The app makes no third-party request, collects nothing, and has no analytics.
Every one of those is a thing money could take away. This brief exists so that if
one is spent, it is spent knowingly and for a stated return.

## 2. The content is not the moat, and that changes the answer

The datasets are **CC-BY-SA-4.0** _(verified: `LICENSE-CONTENT`)_. Anyone may
share and adapt them commercially, provided they attribute and release their
adaptation under the same licence. The generated pack is also 5.0 MB of JSONL
sitting in `public/packs/` on a public GitHub Pages site.

So selling content is weak: the content is already given away, deliberately, and
re-licensing it is a decision the licence makes deliberately hard.

What is not given away is the app and the service around it — the engine, the
FSRS scheduling, the mission ladder, and (once
[accounts-and-sync.md](accounts-and-sync.md) lands) sync across devices. **Sell
convenience, not curriculum.** That also happens to be the version that does not
put a paywall between a learner and the language, which is the version worth
shipping.

One honest caveat before charging for anything: `core-es` is marked
`source: generated, review: unreviewed`, nothing in it is signed off, and roadmap
item 0 says only a human reading the Spanish changes that _(verified)_. Charging
for unreviewed machine-generated Spanish is a credibility risk rather than a
technical one, and it is a real one. **Editorial review is a monetisation
prerequisite**, not a parallel track.

## 3. Ads: recommended against on web, constrained everywhere

Ads are the option that fights this codebase hardest, and the reasons are
concrete rather than aesthetic.

- **Four test files read the stylesheets as text** and fail the build on a colour
  outside a theme file, a border outside two enumerated exceptions, a hover state
  that can repaint a control in a colour its label was not chosen for, and a
  duration or easing outside `primitives.css` _(verified: `tests/a11y/`,
  [skeleton.md](../skeleton.md))_. A third-party ad iframe is none of those things
  and cannot be made to be.
- **The app works offline.** An ad slot is a network dependency in a product
  whose selling point is a train.
- **An ad SDK is a tracking surface**, which means a consent-management
  obligation (GDPR/TCF) and an ATT prompt on iOS — in the app that currently
  needs no privacy policy at all (see
  [accounts-and-sync.md](accounts-and-sync.md) §5).
- WCAG 2.2 AA is enforced in CI _(verified)_. Ad creatives are not, and an ad
  that fails contrast fails it inside your product.

If ads happen anyway, these are the boundaries, and they are not negotiable
without a stated reason:

1. **Native builds only.** Never on the web build, which stays the free,
   trackerless one.
2. **Non-personalised.** No behavioural profile, ever, and certainly none built
   from what someone is struggling to learn.
3. **One placement: the end-of-session summary.** Never during a session, never
   between cards, never on Home. The summary is the one screen that is already an
   ending.
4. **Never in the way of an answer.** No interstitial can sit between a learner
   and the next card.

## 4. Donations first, because they cost almost nothing

The cheapest real step, and the only part of this brief worth doing now: a link
in Settings → About. That section already exists as its own file
(`features/settings/AboutSettings.tsx`) _(verified)_, the settings shell only
picks between sections, and adding one row changes no architecture.

GitHub Sponsors, Ko-fi or Liberapay. No SDK, no network call the learner did not
initiate, no consent banner, no privacy policy.

One catch worth knowing before it surprises anyone: **on iOS this is probably not
allowed as a plain external link.** Apple requires in-app purchase for digital
goods and permits external donation links only for approved nonprofits
_(unverified — check the current guideline text; do not build against this
paragraph)_. So the iOS shape of "donations" is realistically a tip-jar IAP.
Play is understood to be more permissive. Either way, the web build can carry the
plain link, which is another reason the web build stays primary
([native-port.md](native-port.md) §10.1).

## 5. A supporter tier, if anything

The defensible paid product, in order of how well it fits what exists:

1. **Sync and backup across devices** — [accounts-and-sync.md](accounts-and-sync.md).
   Costs real money to run, which is the honest basis for charging for it, and it
   is convenience rather than curriculum.
2. **Canonical audio** — roadmap item 3. Real recurring cost (synthesis, and ~2
   hours of human listening per voice), and a real quality difference over device
   voices. But check the voice licence question in
   [canonical-audio.md](canonical-audio.md) before assuming the output may be sold
   as well as shipped.
3. **A supporter badge that unlocks nothing.** Weakest revenue, strongest fit.

The rule that keeps this from becoming a different product: **nothing pedagogical
goes behind a payment.** Not a level, not a mission, not a category, not the
scheduler. A learner who pays nothing gets the whole language.

## 6. Judgement calls left open

**6.1 Whether money requires accounts.** A receipt wants an identity, so a paid
tier is the one feature with a real reason to require an account
([accounts-and-sync.md](accounts-and-sync.md) §6.2). Let it be _that_ — one
feature behind an account — rather than the reason accounts exist.

**6.2 The licence, again.** [native-port.md](native-port.md) §2 has to be settled
for the store at all, and a commercial build under AGPL is legally fine but
practically constrained. Same decision, decided once, in that task.

**6.3 Whether to do any of this yet.** The app is `0.1.0-alpha.4`, the pack is
unreviewed, and there is no audience _(verified)_. §4 is worth half a day now
because it is nearly free. Everything else in this file is worth revisiting when
there are learners to ask, and the honest reason to write it down today is so
that the mobile and accounts work does not accidentally foreclose an option.
