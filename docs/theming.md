# Theming

Themes are data, not code. Adding a palette touches three small places and
nothing else in the app.

## Appearance is four independent axes

Light or dark, which colours, how far apart they sit, and how big the text are
four different choices. They must not be encoded into one combined theme id:
doing so would require variants such as `dark-teal-large-more` and would make
every new palette multiply the number of combinations.

| Attribute on `<html>` | Chooses                       | Values                           | Registry                 |
| --------------------- | ----------------------------- | -------------------------------- | ------------------------ |
| `data-theme`          | light or dark                 | `light`, `dark`                  | `styles/themes.ts`       |
| `data-palette`        | which hues                    | `indigo`, `teal`, `plum`, `sand` | `styles/themes.ts`       |
| `data-contrast`       | how far apart the neutrals go | `soft`, `normal`, `more`, `max`  | `styles/contrast.ts`     |
| `data-reading-size`   | the type scale                | `small`, `medium`, `large`       | `styles/reading-size.ts` |

Every combination is possible, and every combination is checked: a learner can
use Large text in the Sand palette at Maximum contrast, and
`tests/a11y/contrast.test.ts` holds each palette to WCAG AA at each contrast
level. `system` resolves against `prefers-color-scheme` and keeps following it
while the app is open; the other three axes are the learner's outright.

The reading-size axis scales the rem-based type system from the root, so
component styles and hierarchy never fork.

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

The pre-paint script repeats the four lists as literals, because it cannot import
a module. That is the one duplication in the system, and `contrast.test.ts`
asserts the lists match the registries — a palette added to one and not the other
would be applied only after boot, which reads as a flash of the wrong colours
rather than as a bug.

## Files

| File                                     | Holds                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| `src/styles/primitives.css`              | spacing, radii, type, motion, icon sizes, z-index, layout — never colour |
| `src/styles/themes/<id>-<mode>.css`      | one palette in one mode, colour roles only                               |
| `src/styles/contrast/<level>-<mode>.css` | one contrast level, neutral roles only, no colour of its own             |
| `src/styles/themes.ts`                   | the theme and palette registries, and how a theme resolves               |
| `src/styles/contrast.ts`                 | the contrast registry and the root attribute                             |
| `src/styles/reading-size.ts`             | reading-size registry, root attribute and pre-paint cache                |
| `src/components/ThemeToggle.tsx`         | light/dark, in compact and full variants                                 |
| `src/components/PaletteControl.tsx`      | the palette picker, with live swatches                                   |
| `src/components/ContrastControl.tsx`     | the four-step contrast scale                                             |

`global.css` imports every palette **before** every contrast level. That order is
load-bearing rather than tidy: a palette and a level tie on specificity, so the
later import wins, and a level is meant to restate what a palette declared.
Reverse it and every level silently stops applying. The test asserts the order.

## Adding a palette

1. Create `src/styles/themes/<id>-dark.css` and `<id>-light.css`, each declaring
   every colour role. Copy `indigo-light.css` as the starting point — the
   required roles are exactly the ones it defines.
2. Import both in `src/styles/global.css`, above the contrast imports.
3. Add `{ id: '<id>', label: '…', description: '…' }` to `PALETTE_OPTIONS` in
   `src/styles/themes.ts`, and `<id>` to `PALETTES` — and to the pre-paint list
   in `index.html`.

That is all. The settings picker, the style guide and the preference storage pick
it up automatically, and the swatches are the palette itself rather than a copy
of its colours.

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
| `--color-kind-1…6`        | the categorical family: which kind of material     |
| `--color-kind-1…6-soft`   | each one's companion tint                          |
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

`--color-kind-1` … `--color-kind-6` and their tints are six hues sharing one
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
  surface is what has to be cleared. Getting this backwards produces six hues
  that pass on a card and fail on their own badge.
- **Three pairings are checked per hue**, generated from `KIND_HUE_COUNT`: the
  hue on a card, the hue on its own tint, and body text on that tint. All at
  4.5:1 — these badges carry digits, not only glyphs.

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
