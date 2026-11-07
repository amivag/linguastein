# Scaffolding another app

This working app is the scaffold. Keep generic code exercised here rather than
maintaining an empty template that can drift. Read [framework.md](framework.md)
for the learning core and [server-foundation.md](server-foundation.md) for future
PHP/SQL and account boundaries.

## Reuse inventory

| Keep the mechanism                                                 | Adapt or replace                                                       |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `src/engine/`: memory, drill selection/material, seeded randomness | Subject evidence, generators, content model and grading                |
| `app/identity.ts`, build identity, error-boundary pattern          | App identity values, static icons/artwork and npm metadata             |
| `src/appearance/`, palette solver, tokens and surface recipes      | App theme catalog/CSS, grammar semantics and material-kind assignments |
| `src/layout/`, Button, Chip, Sheet, Icon and focus containment     | AppShell/AppNav course/voice composition                               |
| Contrast, motion, hover and design-language checks                 | Screen accessibility tests and grammar examples in `/design`           |
| Strict TypeScript, lint boundaries and CI/local-gate parity        | Directory coverage entries and subject-specific dataset steps          |
| Async storage interfaces and transaction pattern                   | Spanish records, IndexedDB schema, exports and settings                |

`ThemeToggle` uses the app service provider. `UpdateBanner` needs the update
service. Shared directory placement does not imply provider independence.

Copy `src/layout/` with the design tokens for provider-independent `PageLayout`.
Its slots accept header controls, breadcrumbs, notices and navigation. The host
formats `documentTitle` and supplies routes/services. Navigation flows by default;
`navigationLayout="bar-rail"` reserves `--nav-height` / `--rail-width` space for a
fixed bar/rail. `AppShell` composes the Spanish controls over this layout; keep it
with the app. `tests/fixtures/rhythm-layout.tsx` demonstrates a different host.
`src/utils/random.ts` re-exports the engine, so retain the engine when copying it.

## Starting sequence

1. Copy the repository and edit `src/app/identity.ts`: id, name, tagline,
   description and base path. Change npm metadata and static branding too.
   A new app needs a distinct storage identity; deployed renames need migration.
2. Keep the shared engine if using its pedagogy. Replace `src/domain`, language
   modules, content/data tooling, routes, providers and screens for the new
   subject; remove their obsolete tests in the same change.
3. Keep generic controls and appearance mechanisms, auditing imports first.
   Preserve URL-owned shareable state and device-versus-scope settings.
4. Compose adapters in the new app's services root. Keep subject, UI, persistence
   and optional server boundaries separate. Do not replace local reads with
   network calls just because the app may eventually have accounts.
5. Update architectural lint globs and coverage entries for the resulting tree.
   Establish coverage for genuinely new layers and raise it as tests grow;
   never lower a floor to hide regressions in reused code.
6. Adapt dataset validation and clean-tree generation checks to the new app.
   Keep CI and its local gate aligned, with formatting last. Replace `AGENTS.md`
   with concise app-specific rules and topic links.
7. Run the full gate and production build. Check installed metadata, offline
   behavior, main navigation and the subject's input loop on real devices.

## Known limits

- The app wrapper, storage and learning screens contain Spanish/course concepts;
  see the current findings in [current-state.md](current-state.md).
- There is no browser end-to-end test suite, dead-code check or enforced bundle
  budget. Add them to a demonstrated need, using measured limits.
- UI strings are English literals. Errors and policy violations are kept on the
  device (`app/diagnostics.ts`) and copied from Settings → About; nothing sends
  them anywhere. Identity also owns the chrome colour and orientation.
- An import alias is configured; inspect current usage before choosing a
  convention for the new app. Do not carry historical import counts as guidance.
- Concurrent agents need separate worktrees to avoid staging each other's work.

Detailed appearance invariants belong in [theming.md](theming.md), interaction
rules in [design-language.md](design-language.md), and dependency boundaries in
[architecture.md](architecture.md). Do not copy those narratives into this guide.
