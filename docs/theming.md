# Portable appearance and app theme plugins

The shared mechanism is `@platform/appearance` (`packages/appearance`); each app supplies its namespace,
theme catalog and CSS. Themes are build-time plugins: apps may combine theme
modules, but arbitrary runtime downloads/installation are not implemented.
Existing Spanish preferences, palette ids, CSS values and control APIs remain
compatible. See live `/design` for the rendered token/control reference.

## Ownership

| Location                   | Responsibility                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `axis.ts`                  | Injectable host, namespaced axes, validation, application and pre-paint serialization |
| `catalog.ts`               | Validated, immutable theme metadata and fallback selection                            |
| `mode.ts`                  | System/light/dark preference resolution, independent of app colors                    |
| `src/app/themes.ts`        | This app's theme modules, labels, descriptions, order and default                     |
| `src/app/themes.css`       | This app's palette stylesheet imports                                                 |
| `src/styles/themes/*.css`  | This app's light/dark role definitions and intensity variants                         |
| `src/styles/appearance.ts` | Binds shared mechanics to `APP.id`                                                    |
| `src/styles/themes.ts`     | Compatibility adapter for existing UI/storage imports                                 |
| `src/styles/axes.ts`       | App composition of theme, palette, contrast, intensity and size                       |
| `src/styles/global.css`    | Shared primitives, app palette entry, then contrast overrides                         |

The portable directory imports no app identity, React, CSS or external modules.
It compiles without DOM/Node ambient types alongside the engine. Boundary tests
reject dependencies on the host app; coverage floors match the pure domain.

## Supplying another app's themes

Keep `@platform/appearance` unchanged. Register the app's metadata once:

```ts
import { createAppearance, defineThemeCatalog } from '../appearance';

const studio = { id: 'studio', label: 'Studio', description: 'Quiet practice.' } as const;
const pulse = { id: 'pulse', label: 'Pulse', description: 'Brighter practice.' } as const;
const themes = defineThemeCatalog([studio, pulse], 'studio');
const appearance = createAppearance({ namespace: 'rhythm' });
const palette = appearance.defineAxis({
  key: 'palette',
  values: themes.ids,
  fallback: themes.defaultId,
});
```

A module can export one definition or a collection; combine collections at app
composition. Ids, options and fallback derive from that one catalog. Ids must be
unique and CSS-safe, labels nonempty, and the default registered. Registration
snapshots metadata so mutation cannot desynchronize validators and options.
`themes.resolve(storedValue)` handles removed/unknown ids using the app default.
The existing preference boundary likewise uses the derived validator/fallback.

Import both mode files for each registered theme in `src/app/themes.css`. That
entry is loaded once by `global.css` before shared contrast files. Core code and
picker components need no edit. Keep this app's palette files together under
`src/styles/themes/`; the contrast suite compares files, registrations and imports
and refuses omitted modes or orphan CSS. Another app replaces that catalog and
those assets rather than inheriting the Spanish palette set.

## Appearance is five independent axes

| Attribute           | Meaning                                           | Current declaration                |
| ------------------- | ------------------------------------------------- | ---------------------------------- |
| `data-theme`        | Resolved light/dark; preference may follow the OS | `styles/themes.ts` via shared mode |
| `data-palette`      | App-supplied theme/color family                   | App catalog via `styles/themes.ts` |
| `data-contrast`     | Neutral separation                                | `styles/contrast.ts`               |
| `data-intensity`    | Hue strength                                      | `styles/intensity.ts`              |
| `data-reading-size` | Type scale                                        | `styles/reading-size.ts`           |

Keep these independent; never encode a combined id. Apps can declare further
axes through `defineAxis` and include them in their composition registry. Labels
and subject-specific semantics remain outside the mechanism. Do not add another
axis merely to rename a theme.

`serializeAxes` produces plain metadata, including actual namespaced storage
keys. `vite.config.ts` injects this into `index.html`; the inline script sets
attributes before first paint, handles unavailable storage/media queries and
falls back per axis. No module in that build import graph may read browser APIs
at module scope. Runtime writes cache preferences under the same keys; mode
application stores `system` while rendering concrete light/dark. Blocked storage
does not prevent attributes applying. IndexedDB remains preference authority;
localStorage is only its first-paint cache. No existing key or data migration is
needed by this extraction.

## Adding a palette

1. Generate both mode files and their calm/vivid variants:
   `npm run build:palette -- new studio --neutral 250 --accent 252 --highlight 318 --wheel 200`.
   Choose hue angles, not hand-tuned colors. Solver decisions live in `SHAPE`
   inside `scripts/build-palette.ts`; another app may need different role goals.
2. Add metadata/default selection in `src/app/themes.ts` and both imports in
   `src/app/themes.css`. Remove obsolete files when removing registrations.
3. Keep the fallback palette first in CSS and give it the bare root/mode
   selectors; other palettes select their id explicitly. Every palette also
   selects descendants carrying `data-palette` so previews use real CSS.
4. Run `npx vitest run tests/a11y/contrast.test.ts`, then the complete gate.
   Every theme must declare the shared role contract and pass all contrast ×
   intensity combinations. Keep semantic colors visibly distinct as well as
   contrast-compliant. No custom theme bypasses accessibility checks.

After manual hue changes, regenerate variants with
`npm run build:palette -- intensity`. A palette's authored state is normal
contrast/intensity; generated variants must not leave stale hues behind.

## Token contract

- Neutrals: `--color-ink` / `--color-paper` anchor the contrast axis. Page, wash,
  surface/raised/sunken, chrome, track, border/strong and text/muted roles derive
  hierarchy. Controls use strong boundaries only where the design language
  permits; decorative separators use the decorative role.
- Meanings: accent is app action, highlight is new material, success/danger are
  verdicts. Each supplies the declared contrast/tint/edge roles used by controls.
  Numbered kind hues and companion tints identify material, not grades.
- Depth: palettes declare the shadow scale and backdrop. Shared primitives own
  geometry, type, layout and motion; palettes remain color-only.
- Contrast overlays change neutrals along the palette's ink/paper axis, never
  hues. Intensities change hues, never neutrals; their variants live inside each
  palette because CSS properties cannot transform their own value recursively.
- Tints derive from the matching hue and paper. Components consume role tokens,
  not per-component colors/mixes. Previews inherit the active mode, contrast and
  intensity rather than drawing copied swatch colors.

`tests/a11y/contrast.test.ts` discovers the complete role/pairing contract from its
assertions and registries. Read it before changing roles. The solver targets
consistent tones rather than maximum chroma, and constrains gamut, semantic
separation and label/background contrast. [Design language](design-language.md)
owns interaction/surface rules; do not duplicate its rationale here.
