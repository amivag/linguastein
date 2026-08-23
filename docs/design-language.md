# The design language

**Written:** 2026-08-21

The live version of this is `/design` in the running app — every token, every
icon, every control, read out of the stylesheets the build is actually using. Open
that to see the system; read this to know why it is that way.

The one-line version: **it is a learning tool, so it should feel alive without
being loud.** That constraint is inherited from
[docs/tasks/game-feel.md §3](tasks/game-feel.md), which is still the authority on
what "more of a game" must not mean.

---

## The six rules

### 1. Depth, not outlines

A border is drawn only where it is the _only_ thing identifying a control.
Everywhere else, hierarchy comes from surface, tint and shadow.

This is the rule that changed the app most, so it is worth being precise about
what it is not: it is not a claim that borders are inaccessible. WCAG 1.4.11 asks
for 3:1 contrast on the visual information that identifies a control — and the
Understanding document is explicit that it does not require a control to _have_ a
boundary indicator, only that a boundary must reach 3:1 if one exists. A filled
button with a label at 4.5:1 is identified by its label and its fill.

So the exceptions are narrow and enumerated, in
[`tests/a11y/design-language.test.ts`](../tests/a11y/design-language.test.ts):

| Where                               | Why                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `select`, `input`, `textarea`       | No fill, and no label inside the control. The boundary genuinely is the affordance. |
| The rule between lines of a passage | Two runs of prose, same colour, same size. Nothing else can separate them.          |

That test fails on any border anywhere else. Adding one means adding a row with a
reason of that kind — which is the point: a border should be a decision someone
wrote down, not a default someone reached for.

Before: 138 border declarations across 24 stylesheets. After: three.

### 2. Soft geometry

`--radius-pill` for controls that _select_ — chips, levels, badges, the mic.
Container radii for things that _hold_: `--radius-lg` for a card, `--radius-xl`
for a sheet or the screen's own subject. `--radius-xs` exists for a highlight
drawn behind text, where anything larger reads as a button.

Nothing in the app is a right-angled box.

### 3. Overlay, never push

A control that expands opens **over** the page, through
[`Sheet`](../src/components/Sheet.tsx) — a bottom sheet on a phone, a panel on a
pointer device.

The rule earns its place from a specific failure. `FocusPicker` used to open an
inline panel: pressing it pushed the quick-session buttons, all six presets and
the rest of Home down by roughly four hundred pixels, so narrowing _what_ you
practise moved the button you were reaching for off the screen. The height of a
screen must never be a function of which panels happen to be open.

`Sheet` also carries the parts a hand-rolled overlay forgets: the `82dvh` cap,
`overscroll-behavior: contain` so a flick that runs out of sheet does not scroll
the page behind it, safe-area padding at the bottom, and an arrival animation
with **no fill mode** — so a renderer that never composites shows the sheet where
it belongs instead of stranding it at the first keyframe. The design-language test
asserts that no second copy of it appears.

### 4. One display voice

Spanish is set in `--font-display` and set large. The furniture — labels, counts,
hints, nav — stays small and quiet. The learner's eye should land on the language,
not on the interface.

“Quiet” must not mean difficult to read. Settings offers Small (the original
scale), Medium and Large. The choice scales the complete rem-based type hierarchy
from the root and stays independent of the colour theme; isolated per-component
font overrides would make the interface internally inconsistent.

Both faces resolve from what the device already has. No webfont, so nothing can
fail to load on a plane, and the offline-first contract stays intact.

### 5. Colour means something

Four hues, four meanings:

| Role                | Means                                            |
| ------------------- | ------------------------------------------------ |
| `--color-accent`    | The app acting: the next thing to press, a link. |
| `--color-highlight` | New material — an invitation, not an obligation. |
| `--color-success`   | A correct verdict, a word that moved up.         |
| `--color-danger`    | An incorrect verdict.                            |

A fifth hue would need a fifth meaning. A tint is always a role
(`--color-*-soft`) rather than a `color-mix` invented per component — that is
what made the same "correct" green come out three shades across the card, the
option and the summary.

A palette changes which hues these are, never what they mean. There are four —
Indigo, Teal, Plum and Sand — and `sand` inverts the temperature, so its
highlight is cool: a warm accent beside a warm highlight reads as one hue at two
strengths, and the highlight's whole job is to be a second voice.

Every role passes contrast in **every** palette at **every** contrast level,
checked by [`contrast.test.ts`](../tests/a11y/contrast.test.ts), which discovers
both from their directories. No component may hard-code a colour; the
design-language test fails on a hex or an `rgb()` outside `src/styles/themes/`.
That includes a preview of a palette — the picker's swatches carry
`data-palette` and are painted by the palette's own stylesheet.

### 6. Motion confirms, never informs

An animation may accompany a state change. It may never _be_ the state change —
the same rule that rules out colour-only feedback. Every transition collapses
under `prefers-reduced-motion`, globally, in `global.css`.

Components name an intent (`var(--transition-fast)`), never a duration and a
curve. [`motion.test.ts`](../tests/a11y/motion.test.ts) refuses both a hard-coded
duration and a named easing outside `primitives.css`.

---

## Where things live

```text
src/styles/primitives.css       everything that is not colour: space, shape, type,
                                motion, icon sizes, z-index, nav dimensions
src/styles/themes/<id>.css      colour roles and shadows, one file per theme
src/styles/reading-size.ts      the independent Small / Medium / Large scale
src/styles/surfaces.module.css  shared recipes: card, cardPrimary, cardInteractive,
                                well, sectionLabel, listReset — composed into a
                                screen's own classes with `composes`
src/styles/global.css           the reset, the page wash, focus rings, and native
                                form-control chrome
src/styles/tokens.ts            reads the tokens back out of the loaded stylesheets
src/components/icons.ts         the icon set, behind a seam
src/features/design/            the live style guide at /design
```

### Adding a token

Put it in `primitives.css` if it is not a colour, or in **every** file under
`src/styles/themes/` if it is. It appears on `/design` on its own — the guide
enumerates what the stylesheets declare rather than holding a list. Name it for
its **role** and namespace it (`--radius-2xl`, not `--big-round`), because the
guide groups by name prefix and an unnamespaced token lands in "Everything else".

A new colour role should get a row in `contrast.test.ts`'s `PAIRS` naming what it
sits on and at what ratio. Roles not in `PAIRS` are unchecked, which is the same
as unspecified.

### Adding a surface

If two screens want the same material, add a recipe to
`surfaces.module.css` and `composes:` it. One caveat, learned the hard way: CSS
Modules only allows `composes` on a rule whose selector is a **single local
class**, so `.filter select { composes: … }` is a build error. Style native
elements in `global.css` instead.

### Adding an icon

One line in `src/components/icons.ts`. Import the Lucide component and map a
**semantic** name to it — `listen`, not `ear`. A pictorial name is how two
screens end up illustrating one idea with different glyphs, and how a better
drawing becomes unadoptable because six files hard-coded the old one's name.

Nothing outside `icons.ts` may import from `lucide-react`. That is the same rule
`src/app/services.ts` applies to TTS and storage, for the same reason: swapping
the set should be one edit, not forty.

---

## The icon set

**Lucide**, ISC licensed, via `lucide-react`. Chosen because:

- **Licence.** ISC is permissive and compatible with the app's AGPL-3.0.
- **One geometry.** ~1,600 icons on a single 24px grid at a single stroke weight,
  so a screen mixing eight of them still looks like one set. This is where most
  icon libraries fail in practice.
- **Tree-shaken per icon.** Each glyph is its own ES module, so the bundle carries
  the sixty-odd the app names and none of the rest.
- **`currentColor` throughout.** An icon inherits from the control it sits in, so
  no icon needs a theme rule and none can be off-palette.

Size and stroke come from `--icon-*` tokens applied in **CSS**, not through
Lucide's `size` prop — a call site cannot introduce a nineteenth pixel size, and
the stroke scales with the box so a 16px glyph does not look bolder than a 32px
one.

Icons are `aria-hidden` by default. An icon in this app sits inside a control that
already has a name, and a second name on the glyph makes a screen reader read the
button twice. `Icon`'s `label` prop is the escape hatch for the rare standalone
glyph.

---

## Navigation

Five destinations, always visible: a tab bar within thumb reach on a phone, a rail
down the left once there is room. Fixed on every screen except a running session,
which fills the screen deliberately.

Never a hamburger. Five destinations is not enough to hide, and a menu that has to
be opened is a menu that has to be _found_ — the app is used in two-minute
stretches, standing up, so a learner should never be one wrong tap from being
lost.

The active tab wears a filled pill behind its icon rather than only a colour
change: position survives a colour-vision difference because a _shape_ appears
rather than a hue changing. The label never disappears, so the icons do not have
to be self-explanatory. The pill is a separate element from the glyph so it can
grow into the tint without the glyph moving — switching sections does not shuffle
the row.

The bar's height and the rail's width are `--nav-height` and `--rail-width`, and
`AppShell` reserves space from the same tokens the nav is drawn with. They were
four hand-written numbers describing two things, which is how a taller bar ends
up overlapping the last button on a page.

---

## Why not Tailwind

It was considered, and declined. Not on taste — on what this repository already
enforces.

The app's design system is not a styling mechanism, it is a set of **testable
constraints**: colour must come from a role that passes contrast in every theme;
motion must come from a named scale; a selected state must be an ARIA attribute
so its hover cannot collide with the unselected one; a border must be one of two
enumerated exceptions. Four test files read the stylesheets as text and fail the
build on a violation.

Utility classes are applied in TSX, where none of that is checkable. `bg-white`
bypasses the role tokens, `duration-200` bypasses the motion scale, and
`tests/a11y/*` would go quiet without failing — the worst possible outcome for a
guard. Keeping them honest would mean rebuilding every check as a lint rule over
JSX string literals, which is strictly harder than reading CSS.

Against that, the wins are small here. Theming is already custom properties, which
is what Tailwind v4's `@theme` compiles to anyway. Co-location is already there:
CSS Modules put the styles next to the component. And the migration would rewrite
26 stylesheets whose comments carry most of the design reasoning in this
repository.

The real problem was never the mechanism. It was the values and the visual
language — which is what the six rules above changed, with the token system left
where it was.
