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

| File                             | Holds                                                          |
| -------------------------------- | -------------------------------------------------------------- |
| `src/styles/primitives.css`      | spacing, radii, type scale, layout, tap targets — never colour |
| `src/styles/themes/*.css`        | one file per theme, colour roles only                          |
| `src/styles/themes.ts`           | the registry: ids, labels, icons, resolution                   |
| `src/components/ThemeToggle.tsx` | the control, in compact and full variants                      |

## Adding a theme

1. Create `src/styles/themes/<id>.css` declaring every colour role under
   `[data-theme='<id>']`. Copy `light.css` as the starting point — the required
   roles are exactly the ones it defines.
2. Import it in `src/styles/global.css`.
3. Add `{ id: '<id>', label: '…', icon: '…' }` to `THEME_OPTIONS` in
   `src/styles/themes.ts`.

That is all. The settings radio group, the header toggle and the preference
storage pick it up automatically.

`tests/a11y/contrast.test.ts` discovers theme files from the directory, so the
new theme is immediately held to WCAG AA: it must declare every role, and every
text pairing must clear 4.5:1 (3:1 for interactive boundaries). A theme that
fails cannot be merged.

## Colour roles

| Role                          | Used for                                  |
| ----------------------------- | ----------------------------------------- |
| `--color-bg`                  | page background                           |
| `--color-bg-tint`             | the wash at the top of the page           |
| `--color-surface`             | cards and sheets                          |
| `--color-surface-raised`      | controls sitting on a surface             |
| `--color-surface-sunken`      | rows to pick from, answer slots           |
| `--color-border`              | decorative separators, progress tracks    |
| `--color-border-strong`       | interactive boundaries (must reach 3:1)   |
| `--color-text`                | body text                                 |
| `--color-text-muted`          | hints and labels (must reach 4.5:1)       |
| `--color-accent`              | primary actions, links, focus ring        |
| `--color-accent-contrast`     | text on the accent colour                 |
| `--color-accent-soft`         | accent-tinted panels (must carry text)    |
| `--color-highlight`           | the warm second accent (must reach 4.5:1) |
| `--color-highlight-soft`      | its tinted panel                          |
| `--color-success`             | revealed translations, correct answers    |
| `--color-danger`              | incorrect answers                         |
| `--shadow-card`, `--backdrop` | elevation and modal scrim                 |

### The two tinted roles

`--color-accent-soft` and `--color-highlight-soft` exist to stop the same idea
being spelled four ways. Before them, a tinted panel was written by hand as
`color-mix(in srgb, var(--color-accent) 14%, transparent)` — and 18% somewhere
else, and 22% somewhere else again, none of them contrast-checked because a
mix is not a role. Both are now flat colours a theme declares and the contrast
test holds `--color-text` against.

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
