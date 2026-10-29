# Roadmap

**Reviewed:** 2026-10-29. This is a current work map, not a feature changelog or a
specification. [Current state](current-state.md) owns durable decisions and
verified foundation findings. Source/tests own implementation details; dataset
counts are in the manifests and the public [README](../README.md).

## In place

- React/TypeScript/Vite PWA with IndexedDB and in-memory storage.
- Pure shared learning core for memory scheduling, drill material/selection and
  seeded randomness; Spanish exercises, composition and mastery remain specific.
- Course-scoped routes and URL-described sessions, per-course settings, study
  versus assessed practice, reading, browsing, missions and word inspection.
- Atomic assessment/import/reset operations, consistent export snapshots,
  transactional settings and visible retryable practice-save failures.
- Validated/versioned content packs and translation sets, generated language
  forms, editorial-review tooling and file export/import.
- Device speech services, optional recognition, offline pack controls and
  independently composed appearance axes with accessibility checks.
- Typed production and retrieval evidence; consult their focused briefs for
  remaining stages rather than treating the original proposals as unfinished.

## Foundation priorities

1. Reusable shell layout and explicit learning policies when the second app
   needs them; preserve Spanish behavior.
2. Browser/device coverage, measured bundle limits and dead-code checks where
   they address actual risks. Keep the existing full gate and coverage floors.

## Product work to evaluate

| Area                                                         | Entry point; verify remaining work against source                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Editorial review and broader content                         | [content guide](content-authoring.md), [dataset expansion](tasks/dataset-expansion.md)                                                |
| Canonical audio generation, licensing and listening approval | [canonical audio](tasks/canonical-audio.md)                                                                                           |
| More passages and higher-level missions                      | [passage practice](tasks/passage-practice.md), [more missions](tasks/more-missions.md)                                                |
| Verb depth, non-item drills and mastery                      | [verb cards](tasks/verb-cards.md), [numerals](tasks/numerals.md)                                                                      |
| Typed production and diagnostic evidence                     | [typed production](tasks/typed-production.md), [retrieval evidence](tasks/retrieval-evidence.md)                                      |
| Additional languages and pack resolution                     | [second language](tasks/second-language.md), [language matrix](tasks/language-matrix.md), [pack addressing](tasks/pack-addressing.md) |
| Interaction polish, offline/install UX and raster PWA icons  | [game feel](tasks/game-feel.md), [architecture](architecture.md)                                                                      |

These are candidate work areas, not a promise that every historical brief is
unimplemented. Keep content generation distinct from human editorial approval.

## Future directions; not immediate implementation

- **Other learning apps:** a hands/pencils rhythm trainer is being considered.
  [Framework](framework.md) defines the reusable core and first timing/input slice;
  [skeleton](skeleton.md) covers scaffolding.
- **Users, registration and sync:** guest access remains available. Modern PHP
  is likely; SQLite, MySQL, MariaDB and PostgreSQL are candidates. No vendor,
  auth method or database is fixed. [Server foundation](server-foundation.md)
  owns identity, guest adoption, account switching, HTTP and SQL requirements.
- **Native distribution:** [native-port](tasks/native-port.md) is a historical
  investigation; verify device APIs, hosting and distribution/licensing rules
  when selecting this work.
- **Commercial features:** [monetisation](tasks/monetisation.md) is a historical
  product brief, not an active implementation commitment.

Social features, moderation, a generic plugin/package platform and an AI tutor
remain unimplemented possibilities. Select concrete needs before extending the
base. Task briefs and `spec/` retain rationale; use headings/search to load only
relevant sections, and correct stale status before resuming a brief.
