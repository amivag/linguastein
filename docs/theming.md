# Theming

Themes are data, not code. Adding a palette is one command and three small
registrations, and nothing else in the app changes.

This layer is meant to be **portable**: other apps are scaffolded from this
repository, so nothing here knows what the app is. The axis mechanism, the
contrast levels, the palette solver and the contrast test are all app-agnostic;
what an app replaces is the list of palettes and the role names it uses. See
[skeleton.md](skeleton.md) for the split.

## Appearance is five independent axes

Light or dark, which colours, how far apart the neutrals sit, how loud the hues
are, and how big the text is are five different choices. They must not be encoded
into one combined theme id: doing so would require variants such as
`dark-teal-large-more-vivid` and would make every new palette multiply the number
of combinations.

| Attribute on `<html>` | Chooses                       | Values                                                     | Registry                 |
| --------------------- | ----------------------------- | ---------------------------------------------------------- | ------------------------ |
| `data-theme`          | light or dark                 | `light`, `dark`                                            | `styles/themes.ts`       |
| `data-palette`        | which hues                    | `indigo`, `teal`, `plum`, `sand`, `slate`, `rose`, `olive` | `styles/themes.ts`       |
| `data-contrast`       | how far apart the neutrals go | `soft`, `normal`, `more`, `max`                            | `styles/contrast.ts`     |
| `data-intensity`      | how loud the hues are         | `calm`, `normal`, `vivid`                                  | `styles/intensity.ts`    |
| `data-reading-size`   | the type scale                | `small`, `medium`, `large`                                 | `styles/reading-size.ts` |

Every combination is possible, and every combination is checked: a learner can use
Large text in the Sand palette at Maximum contrast with Calm colour, and
`tests/a11y/contrast.test.ts` holds each palette to WCAG AA at every contrast
level × every intensity — 84 combinations as this is written. `system` resolves
against `prefers-color-scheme` and keeps following it while the app is open; the
other four axes are the learner's outright.

The reading-size axis scales the rem-based type system from the root, so component
styles and hierarchy never fork.

**Contrast and intensity are deliberately two axes**, and they are the two halves
of "this is too much". One means the greys are too sharp; the other means the
colour-coding is too loud. Folding them together would give every learner the same
compromise, which is what one axis was already doing. They cannot interfere,
because a contrast level restates only neutrals and an intensity only hues — an
invariant `contrast.test.ts` asserts rather than assumes.

## An axis is a declaration

All five are built from one mechanism in `src/styles/appearance.ts`:

```ts
export const CONTRAST_AXIS = defineAxis({
  key: 'contrast',
  values: CONTRAST_LEVELS,
  fallback: DEFAULT_CONTRAST,
});
```

and the storage key, the validator and the `apply` that writes the root attribute
come with it. Each axis's _meaning_ — its labels, its reasoning, anything special
it does — stays in its own module; `src/styles/axes.ts` only enumerates them.

Two constraints on that registry, both structural:

- **Nothing in its import graph may touch the DOM at module scope.**
  `vite.config.ts` reads it at build time, and the config project compiles with
  `lib: ["ES2023"]` — no DOM — precisely so config code cannot reach for the
  document. `appearance.ts` therefore reaches the document through `globalThis`
  and no-ops without one, which is the more correct shape anyway: an axis is a
  value, and only one of the things it does needs a browser.
- **An axis contributes data, never a function.** What crosses into the HTML is
  JSON. The one behaviour the pre-paint script needs — resolving `system` against
  an OS media query — travels as the `system` flag rather than as code.

## How it works

`<html>` always carries all four attributes. A tiny script in `index.html` sets
them before first paint — reading the saved preferences from `localStorage` — so
nothing flashes, and each palette is declared exactly once per mode in CSS
instead of being duplicated into a media query.

```text
index.html (pre-paint)     →  data-theme="light" data-palette="teal" data-contrast="more" …
src/styles/themes/*.css    →  [data-theme='light'][data-palette='teal'] { --color-…: … }
src/styles/contrast/*.css  →  [data-theme='light'][data-contrast='more'] { --color-…: mix(…) }
src/styles/themes.ts       →  the registries the settings UI and the tests read
IndexedDB preferences      →  source of truth; localStorage is a cache for paint
```

The pre-paint script cannot import a module, so the axis registry is **injected**
into it: `vite.config.ts` replaces `%APPEARANCE_AXES%` with
`JSON.stringify(prePaintAxes())` at build and dev time, exactly as it replaces
`%APP_ID%` from `identity.ts`.

This used to be a literal copy of every list, guarded by a test comparing the two.
The guard worked, and a guard is the wrong tool for a duplication you can delete:
adding a palette or a whole new axis now needs no edit to `index.html` at all.
What the test still checks is that nobody puts the copy back — a hand-written
array would work, and would silently stop tracking the registry the moment a value
was added, which is the failure the old test existed to catch.

## Files

| File                                     | Holds                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| `src/styles/primitives.css`              | spacing, radii, type, motion, icon sizes, z-index, layout — never colour |
| `src/styles/themes/<id>-<mode>.css`      | one palette in one mode, colour roles only                               |
| `src/styles/contrast/<level>-<mode>.css` | one contrast level, neutral roles only, no colour of its own             |
| `src/styles/themes.ts`                   | the theme and palette registries, and how a theme resolves               |
| `src/styles/appearance.ts`               | the axis mechanism: one `defineAxis` for all five                        |
| `src/styles/axes.ts`                     | the axis registry, injected into the pre-paint script                    |
| `src/styles/contrast.ts`                 | the contrast registry and the root attribute                             |
| `src/styles/intensity.ts`                | the intensity registry, and why its blocks live in the palettes          |
| `scripts/build-palette.ts`               | solves a palette, and regenerates the intensity blocks                   |
| `src/styles/reading-size.ts`             | reading-size registry, root attribute and pre-paint cache                |
| `src/components/ThemeToggle.tsx`         | light/dark, in compact and full variants                                 |
| `src/components/PaletteControl.tsx`      | the palette picker, with live swatches                                   |
| `src/components/ContrastControl.tsx`     | the four-step contrast scale                                             |
| `src/components/IntensityControl.tsx`    | the three-step colour intensity scale                                    |

`global.css` imports every palette **before** every contrast level. That order is
load-bearing rather than tidy: a palette and a level tie on specificity, so the
later import wins, and a level is meant to restate what a palette declared.
Reverse it and every level silently stops applying. The test asserts the order.

## Adding a palette

A palette is roughly 24 categorical hues and their tints, four meanings and their
tints, eleven neutrals and five shadows, per mode — and every one has to clear
WCAG AA against every ground four contrast levels can produce, at three
intensities. Do not author that by hand. Hand-tuning converges on mud, because the
colours that are easy to find by eye are the desaturated ones: they are the ones
with contrast to spare.

1. **Solve it.** Pick hue angles, not colours:

   ```sh
   npm run build:palette -- new slate --neutral 250 --accent 252 --highlight 318 --wheel 200
   ```

   `--neutral` is the cast of the greys, `--accent` the primary action,
   `--highlight` the second accent, `--wheel` where the categorical family starts.
   `--cast` (default `0.02`) is how much colour the neutrals carry. This writes
   both modes and their `calm` and `vivid` blocks.

2. **Import both** in `src/styles/global.css`, above the contrast imports.

3. **Register it**: add `<id>` to `PALETTES` and an entry to `PALETTE_OPTIONS` in
   `src/styles/themes.ts`.

4. **Run the judge**: `npx vitest run tests/a11y/contrast.test.ts`.

Nothing else. The settings picker, the style guide, the pre-paint script and the
preference storage all read the registry, and the swatches are the palette itself
rather than a copy of its colours.

Two things to know before choosing angles:

- **`success` is at 152° and `danger` at 26°**, in every palette, because their
  meaning is fixed. An accent near either of those is a palette that cannot ship:
  the primary button would look like a verdict. The test measures this in OKLab
  with lightness excluded, and it is not something a contrast ratio can see.
- **A hue and its `-soft` are one decision.** Tints are `color-mix` of their own
  hue with `paper`, which no contrast level may touch, so they cannot drift.

If you edit a palette's hues by hand afterwards, re-run
`npm run build:palette -- intensity`: the `calm` and `vivid` blocks are derived
from the authored values and are stale until you do.

Each palette file selects on two things:

```css
[data-theme='dark'][data-palette='teal'],
[data-theme='dark'] [data-palette='teal'] {
  …
}
```

The second selector is the **preview seam**. A decorative element carrying
`data-palette` gets that palette's roles declared on itself, so the settings
picker and the style guide can show four real palettes while the page is painted
in a fifth — without a single colour leaving this directory. `indigo` is what an
unset `data-palette` means, so its two files carry the bare `[data-theme='…']`
selector as well, and `indigo-dark.css` also carries `:root` so the app still
renders before the pre-paint script runs.

`tests/a11y/contrast.test.ts` discovers palettes from the directory and refuses a
palette whose two files are not both present, so a new palette is immediately
held to WCAG AA: it must declare every role, and every text pairing must clear
4.5:1 (3:1 for a boundary or a meter) **at all four contrast levels**.

A role is only checked if it appears in that file's `PAIRS` list, so adding a role
means adding a row naming what it sits on and at what ratio. A role absent from
`PAIRS` is unchecked, which is the same thing as unspecified.

## The contrast axis

A contrast level is not a palette. It restates the neutral roles — grounds,
surfaces, text, boundaries — as positions along the palette's own
`--color-ink` → `--color-paper` line, and touches no hue at all:

```css
--color-text-muted: color-mix(in srgb, var(--color-ink) 62%, var(--color-paper));
```

Two things follow, and both are the reason it is written this way. A level works
for a palette authored after it, because the axis carries the hue — More contrast
in Sand stays warm instead of turning grey. And a level cannot be reviewed for
legibility on its own: the test evaluates the mixes and checks the _result_
against every palette, so the numbers are constrained rather than tasteful.

`normal` has no stylesheet. It is the palette exactly as authored — a hand-tuned
position on the axis rather than a computed one — and the attribute is still
written out so a preview can be handed a level without a special case.

The two modes need separate files because depth runs in opposite directions: in a
dark mode a card carries _more_ ink than the page it rests on, and in a light one
it carries less, since there is nothing above white to raise it to.

Soft is deliberately still WCAG AA. A level a learner can pick is a level the app
is responsible for, so the test holds every combination to the same floors — Soft
lowers the shout, not the legibility — and asserts that the four levels come out
in order, so a "softer" level cannot end up sharper than the default.

## The intensity axis

An intensity is the mirror of a contrast level. A level restates the **neutrals**
and may never touch a hue; an intensity restates the **hues** — the accent, the
second accent, the verdicts, the whole categorical wheel — and may never touch a
neutral. Between them they cover the palette, and neither can undo the other,
which is why they compose instead of multiplying into a matrix of themes.

It exists because twelve categorical hues plus four meanings is a lot of colour,
and how much of it a person wants is not a question the app can answer for them.
The same screen reads as helpfully colour-coded to one learner and as busy to
another. Calm and Vivid are the same palette at two volumes, not two palettes to
keep in step.

### Why the blocks live inside the palette files

This is the one place the appearance system is _not_ palette-agnostic, and it is
worth knowing why before trying to tidy it.

A CSS custom property cannot refer to itself, so `--color-accent` cannot be
redefined as a transformation of `--color-accent`. A contrast level escapes this
because it is written in terms of `ink` and `paper` — two roles it does not itself
set — and a hue has no equivalent source. The alternatives were a second name for
every hue in every palette, doubling the role count purely to enable this axis, or
what is there now: each palette carries its own `calm` and `vivid` blocks.

The trade is real and it has a cost: **a new palette must generate its own two
blocks.** `contrast.test.ts` fails until it does, which is what stops a palette
shipping with one volume.

### How the values are found

Chroma is scaled in OKLab — lightness and hue untouched — and the scaling is
walked back wherever a step would drop a role under a floor. A role that cannot
move at all simply stays where the palette put it, which is the correct answer and
not a failure.

Two constraints are less obvious than they look, and both were bugs first:

- **A hue and its own tint move together.** `-soft` is a `color-mix` of its own
  hue, so scaling the hue scales the tint. Checking a scaled hue against an
  _unscaled_ tint is how a vivid badge once shipped at 4.48:1.
- **Vivid can make two hues converge.** Chroma scaling preserves OKLab lightness
  but not sRGB gamut: push two hues towards the edge and both clip, landing closer
  together than they started. A vivid Indigo put its amber highlight 0.061 from its
  red danger where the authored palette had them 0.079 apart — passing every
  contrast floor, and making the primary action look like a wrong answer. So the
  four meanings are scaled by **one factor solved for the palette**, walked back
  until all six pairs stay apart. Per-role scaling cannot work: the constraint is
  pairwise, so scaling one role only moves the problem to its neighbour.

Calm is held to a proportionally lower separation floor than Normal, because
pulling chroma out of every hue necessarily pulls them towards the same grey —
asking otherwise would be asking the axis not to work.

## Colour roles

| Role                      | Used for                                           |
| ------------------------- | -------------------------------------------------- |
| `--color-ink`             | the text end of the contrast axis; never painted   |
| `--color-paper`           | the ground end of the contrast axis; never painted |
| `--color-bg`              | page background                                    |
| `--color-bg-tint`         | the wash at the top of the page                    |
| `--color-surface`         | cards and sheets                                   |
| `--color-surface-raised`  | controls sitting on a surface                      |
| `--color-surface-sunken`  | rows to pick from, answer slots, wells             |
| `--color-chrome`          | the header and the tab bar (see below)             |
| `--color-track`           | the groove a progress bar fills (3:1 vs the fill)  |
| `--color-border`          | decorative separators, the sheet's grip            |
| `--color-border-strong`   | native field outlines (must reach 3:1)             |
| `--color-text`            | body text                                          |
| `--color-text-muted`      | hints and labels (must reach 4.5:1)                |
| `--color-accent`          | primary actions, links, focus ring                 |
| `--color-accent-contrast` | text on the accent colour                          |
| `--color-accent-soft`     | accent-tinted panels (must carry text)             |
| `--color-accent-edge`     | the band a filled button presses down onto         |
| `--color-highlight`       | the warm second accent (must reach 4.5:1)          |
| `--color-highlight-soft`  | its tinted panel                                   |
| `--color-success`         | revealed translations, correct answers             |
| `--color-success-soft`    | the panel a correct verdict sits on                |
| `--color-danger`          | incorrect answers                                  |
| `--color-danger-soft`     | the panel an incorrect verdict sits on             |
| `--color-kind-1…12`       | the categorical family: which kind of material     |
| `--color-kind-1…12-soft`  | each one's companion tint                          |
| `--backdrop`              | the modal scrim                                    |

`--color-ink` and `--color-paper` are the only roles nothing is painted with
directly. They are the ends of the palette's own contrast axis, held 12:1 apart,
so a palette that offered no room to move would fail rather than make Maximum
mean nothing.

### A palette changes hue, never meaning

The accent is the app acting, the second accent is new material, green and red
are verdicts. Four palettes change which hues those are; none of them changes
what they mean. `sand` is the one that inverts the temperature — warm greys, a
bronze accent, and therefore a _cool_ highlight, because a warm accent beside a
warm highlight reads as one hue at two strengths and the highlight's whole job is
to be a second voice.

### Elevation

With the outlines gone, depth is what carries hierarchy — so the shadow scale is
part of a palette rather than a decoration on top of one. Five values, with
distinct jobs rather than five strengths of one idea:

| Shadow            | For                                                           |
| ----------------- | ------------------------------------------------------------- |
| `--shadow-sm`     | something resting on the page: a card in a list, a button     |
| `--shadow-md`     | the screen's own subject, of which there is one               |
| `--shadow-lg`     | something genuinely above the page: a sheet, a popover        |
| `--shadow-inset`  | the opposite direction — a slot, a track, a row you pick from |
| `--shadow-accent` | the one coloured shadow, under a large primary button only    |

It replaced a single `--shadow-card`. A light palette has nowhere to go above
white, so the shadow is the _only_ thing raising a card there and this scale does
most of the work; a dark one gets its separation from the surface roles and barely
needs it. That asymmetry is why elevation is declared per palette rather than
sitting in `primitives.css` with the other non-colour tokens.

### Chrome, and why it is declared opaque

`--color-chrome` is painted by the header and the tab bar as
`color-mix(in srgb, var(--color-chrome) 88%, transparent)` plus a backdrop blur,
so content reads as passing underneath rather than vanishing at a hard line.

It is declared as a flat colour all the same, because `contrast.test.ts` needs a
real value to check the nav labels against. The mix is deliberately kept above
90%, which is what makes the opaque declaration an honest proxy for what a learner
actually reads text on. Drop it much lower and the check stops meaning anything.

### The tinted roles

`--color-accent-soft`, `--color-highlight-soft`, `--color-success-soft` and
`--color-danger-soft` exist to stop the same idea being spelled four ways. Before
them, a tinted panel was written by hand as
`color-mix(in srgb, var(--color-accent) 14%, transparent)` — and 18% somewhere
else, and 22% somewhere else again, none of them contrast-checked because a
mix is not a role. They are flat colours a palette declares now, and the contrast
test holds both `--color-text` and the matching hue against each one — a verdict
panel has to carry the word _and_ the expected answer.

They are also the pairing a contrast level cannot help with: a level moves the
text and leaves the tint where the palette put it, so the palette has to leave the
room. That is checked at every level, not only at Normal.

### The categorical family

`--color-kind-1` … `--color-kind-12` and their tints are twelve hues sharing one
meaning — _which kind of material this is_ — for the pages that list a lot of
kinds: Study's tiles, its mission and set ladders, the category chips on Browse.
The design rationale is in
[docs/design-language.md](design-language.md#5-colour-means-something); what a
palette author needs to know is smaller:

- **Numbered, not named.** Each palette rotates the wheel to its own temperature,
  so `--color-kind-3` is amber in Indigo and something warmer in Sand. A hue name
  in the token would be a lie in three files out of four.
- **Solve the tint first, then the hue against it.** In a light palette the tint
  is the darker of the two grounds, so a hue that clears its own badge clears the
  card for free; in a dark palette the argument runs the other way and the
  surface is what has to be cleared. Getting this backwards produces twelve hues
  that pass on a card and fail on their own badge.
- **Three pairings are checked per hue**, generated from `KIND_HUE_COUNT`: the
  hue on a card, the hue on its own tint, and body text on that tint. All at
  4.5:1 — these badges carry digits, not only glyphs.
- **The tint is derived, not authored.** Each `-soft` is a `color-mix` of its own
  hue with the palette's `paper` — 16% in a dark palette, 12% in a light one — so
  a hue and its companion cannot drift apart, and nobody has to hand-tune
  twenty-four values per file. `paper` is the right anchor because no contrast
  level may touch it, which is what keeps the tint stable while the text on it
  sharpens.

**How the twelve were picked.** Not by eye: twelve hues times eight files is
ninety-six colours, each of which has to clear three pairings at four contrast
levels, and hand-tuning that converges on mud. They come out of a search in
OKLCH — twelve angles thirty degrees apart from a per-palette base, and one
target lightness and chroma per mode that the whole family shares. For each hue
the search takes the candidate _closest to that target_ among those clearing the
floors, weighting chroma three times as heavily as lightness.

The objective matters more than the method. Maximising chroma instead walks every
hue to the edge of the sRGB gamut, and the result is a neon rainbow — legible,
contrast-passing and completely wrong for this app. Anchoring to a shared target
is what makes twelve hues read as one family, and it is why they are not as
saturated as they could be. If you add a palette, the base angle is the only
number you need to choose; run the search rather than guessing, and let
`contrast.test.ts` be the judge.

`--color-highlight` is deliberately _not_ a semantic. It is the second accent, for
the places where another colour is liveliness rather than meaning — the "new
material" count, an emphasis mark. Success, danger and accent carry all the
meaning there is; adding a fourth meaning is not what this role is for. It must
still read as text in both modes, which is the hard part of a warm hue on a light
page: it has to be dark enough to clear 4.5:1 on near-white without turning to
mud.

### The page wash

`global.css` paints the body as a fixed `linear-gradient` from
`--color-bg-tint` down to `--color-bg`. That is presentation, so it lives in
`global.css`; the two colours are roles, so they live in the palette. A palette
that wants no wash sets both to the same value — nothing else has to change.
