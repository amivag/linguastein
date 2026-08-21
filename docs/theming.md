# Theming

Themes are data, not code. Adding one touches three small places and nothing
else in the app.

## How it works

`<html>` always carries a concrete `data-theme` (`dark` or `light`). A tiny
script in `index.html` sets it before first paint — reading the saved
preference from `localStorage` and resolving `system` against the OS setting —
so there is no flash of the wrong theme, and each theme is declared exactly
once in CSS instead of being duplicated into a media query.

```text
index.html (pre-paint)  →  data-theme="light"
src/styles/themes/*.css →  [data-theme='light'] { --color-…: … }
src/styles/themes.ts    →  registry used by the settings UI and the toggle
IndexedDB preferences   →  source of truth; localStorage is a cache for paint
```

## Files

| File                             | Holds                                                                    |
| -------------------------------- | ------------------------------------------------------------------------ |
| `src/styles/primitives.css`      | spacing, radii, type, motion, icon sizes, z-index, layout — never colour |
| `src/styles/themes/*.css`        | one file per theme, colour roles only                                    |
| `src/styles/themes.ts`           | the registry: ids, labels, icons, resolution                             |
| `src/components/ThemeToggle.tsx` | the control, in compact and full variants                                |

## Adding a theme

1. Create `src/styles/themes/<id>.css` declaring every colour role under
   `[data-theme='<id>']`. Copy `light.css` as the starting point — the required
   roles are exactly the ones it defines.
2. Import it in `src/styles/global.css`.
3. Add `{ id: '<id>', label: '…', icon: '…' }` to `THEME_OPTIONS` in
   `src/styles/themes.ts`. `icon` is a **name from the icon set** — one of
   `themeSystem`, `themeLight`, `themeDark` — not a glyph. Widen that union and
   add a matching entry in `src/components/icons.ts` if a new theme needs its own.

That is all. The settings radio group, the header toggle and the preference
storage pick it up automatically.

`tests/a11y/contrast.test.ts` discovers theme files from the directory, so the
new theme is immediately held to WCAG AA: it must declare every role, and every
text pairing must clear 4.5:1 (3:1 for a boundary or a meter). A theme that fails
cannot be merged.

A role is only checked if it appears in that file's `PAIRS` list, so adding a role
means adding a row naming what it sits on and at what ratio. A role absent from
`PAIRS` is unchecked, which is the same thing as unspecified.

## Colour roles

| Role                      | Used for                                          |
| ------------------------- | ------------------------------------------------- |
| `--color-bg`              | page background                                   |
| `--color-bg-tint`         | the wash at the top of the page                   |
| `--color-surface`         | cards and sheets                                  |
| `--color-surface-raised`  | controls sitting on a surface                     |
| `--color-surface-sunken`  | rows to pick from, answer slots, wells            |
| `--color-chrome`          | the header and the tab bar (see below)            |
| `--color-track`           | the groove a progress bar fills (3:1 vs the fill) |
| `--color-border`          | decorative separators, the sheet's grip           |
| `--color-border-strong`   | native field outlines (must reach 3:1)            |
| `--color-text`            | body text                                         |
| `--color-text-muted`      | hints and labels (must reach 4.5:1)               |
| `--color-accent`          | primary actions, links, focus ring                |
| `--color-accent-contrast` | text on the accent colour                         |
| `--color-accent-soft`     | accent-tinted panels (must carry text)            |
| `--color-accent-edge`     | the band a filled button presses down onto        |
| `--color-highlight`       | the warm second accent (must reach 4.5:1)         |
| `--color-highlight-soft`  | its tinted panel                                  |
| `--color-success`         | revealed translations, correct answers            |
| `--color-success-soft`    | the panel a correct verdict sits on               |
| `--color-danger`          | incorrect answers                                 |
| `--color-danger-soft`     | the panel an incorrect verdict sits on            |
| `--backdrop`              | the modal scrim                                   |

### Elevation

With the outlines gone, depth is what carries hierarchy — so the shadow scale is
part of a theme rather than a decoration on top of one. Five values, with distinct
jobs rather than five strengths of one idea:

| Shadow            | For                                                           |
| ----------------- | ------------------------------------------------------------- |
| `--shadow-sm`     | something resting on the page: a card in a list, a button     |
| `--shadow-md`     | the screen's own subject, of which there is one               |
| `--shadow-lg`     | something genuinely above the page: a sheet, a popover        |
| `--shadow-inset`  | the opposite direction — a slot, a track, a row you pick from |
| `--shadow-accent` | the one coloured shadow, under a large primary button only    |

It replaced a single `--shadow-card`. A light theme has nowhere to go above white,
so the shadow is the _only_ thing raising a card there and this scale does most of
the work; a dark theme gets its separation from the surface roles and barely needs
it. That asymmetry is why elevation is declared per theme rather than sitting in
`primitives.css` with the other non-colour tokens.

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
mix is not a role. They are flat colours a theme declares now, and the contrast
test holds both `--color-text` and the matching hue against each one — a verdict
panel has to carry the word _and_ the expected answer.

`--color-highlight` is deliberately _not_ a semantic. It is the warm counterpart
to the accent, for the places where a second colour is liveliness rather than
meaning — the "new material" count, an emphasis mark. Success, danger and accent
carry all the meaning there is; adding a fourth meaning is not what this role is
for. It must still read as text in both themes, which is the hard part of a warm
hue on a light page: it has to be dark enough to clear 4.5:1 on white without
turning to mud.

### The page wash

`global.css` paints the body as a fixed `linear-gradient` from
`--color-bg-tint` down to `--color-bg`. That is presentation, so it lives in
`global.css`; the two colours are roles, so they live in the theme. A theme that
wants no wash sets both to the same value — nothing else has to change.
