# Shared learning foundation

**Reviewed:** 2026-10-29. Spanish uses the shared core today. A rhythm contract
fixture proves a second subject can exercise it; no rhythm app is implemented.
Use [current-state.md](current-state.md) for open findings, not historical reuse
percentages or line counts.

## The copyable core

Depend on `@platform/engine` (`packages/engine`) and import from its index. It has no external imports,
React, browser/Node ambient types, content ids or closed Spanish exercise enum.

| Module      | Shared responsibility                                                   | App responsibility                      |
| ----------- | ----------------------------------------------------------------------- | --------------------------------------- |
| `memory.ts` | Memory state, review grades, scheduler contract and due checks          | Identity, initial state and persistence |
| `fsrs.ts`   | Memory update and next review time                                      | Evidence-to-grade policy                |
| `select.ts` | Due first, unseen in teaching order, then weakest                       | Curriculum membership and ownership     |
| `random.ts` | Injected/seeded randomness                                              | Seeds and session identity              |
| `drill.ts`  | `DrillMaterial<Target>`: sample generation and durable rule attribution | Input, presentation and grading         |

The Spanish scheduler adapter preserves app-owned progress fields. Legacy drill
selection and random paths re-export the shared implementations. `DrillGuide`
extends `DrillMaterial` with text render/parse; non-text subjects need no parser.

`packages/engine/tests/rhythm.test.ts` exercises numeric beat onsets, curriculum selection,
review and lapse scheduling. The boundary test rejects external imports/runtime
module loading; its `tsconfig.src.json` compiles without DOM/Node types. Engine
coverage floors match the domain floors. This establishes the contract, not
physical-input accuracy or motor-learning validity of the memory model.

## Boundaries still owned by each app

- Content, exercise generation, mastery and sessions under `src/domain` remain
  language-shaped. Do not stretch tokenised text and CEFR into universal models.
- Attempts remain subject-specific validated records: rhythm needs timing
  evidence; Spanish uses retrieval modes. Share envelopes only when actual
  implementations demonstrate common requirements.
- Storage schemas, transfers and settings are not generic libraries. Share
  transaction/retry guarantees before sharing records.
- `src/layout/PageLayout.tsx` is provider-independent page structure with slots.
  AppShell supplies course navigation, history, speech and updates; keep that
  wrapper with Spanish. A non-language fixture and dependency test guard the seam.
- The standalone `src/appearance/` core accepts app-owned theme catalogs and CSS.
  Control primitives port; grammar demos, service-bound
  controls and semantic color assignments need adaptation.
- A future PHP/SQL service and users/registration are anticipated, not built.
  [server-foundation.md](server-foundation.md) owns that contract. Local practice
  and the pure engine must stay independent of authentication and connectivity.

## Rhythm: first useful slice

1. Author stable rules for pulse, subdivisions, rests and offbeats. Attribute
   generated targets to those dataset-owned rules; do not invent per-pattern or
   per-tempo ids.
2. Model meter, duration and onset positions in beats, plus hand assignment when
   needed. Tempo maps semantic beats to time; pixels and timer callbacks are not
   content. Keep raw attempt timing, tempo, calibration and grader version.
3. Start with a declared input modality. Screen/keyboard tapping is distinct from
   hearing hands, pencils or claps; the latter needs microphone/onset detection
   and calibration. Put input and sound timing behind adapters.
4. Grade expected versus observed events in pure code: missing/extra taps,
   early/late taps, count-in, tempo and device latency. Decide whether to grade
   absolute alignment, relative rhythm or both; shifting every attempt to its
   first tap would hide consistently late starts.
5. Keep monotonic input timing separate from persisted epoch timestamps. Separate
   rehearsal from assessed attempts; use memory scheduling to choose revisits,
   not as proof of timing mastery.
6. Make a seeded pattern replay, capture a performance, report timing, save rule
   evidence and select the next rule. Verify reload/offline behavior, accessible
   controls, keyboard alternatives and device timing. Do not announce every beat
   in a live region.

Use [skeleton.md](skeleton.md) to scaffold the app. Keep the core here until real
apps need coordinated releases; a package or plugin framework is not necessary
just to make a clean directory reusable.
