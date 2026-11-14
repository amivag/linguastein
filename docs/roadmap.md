# Roadmap

**Reviewed:** 2026-10-29. This is a current work map, not a feature changelog or a
specification. [Current state](current-state.md) owns durable decisions and
verified foundation findings. Source/tests own implementation details; dataset
counts are in the manifests and the public [README](../README.md).

## In place

- React/TypeScript/Vite PWA with IndexedDB and in-memory storage.
- Provider-independent page layout; app wrapper supplies navigation and services.
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

1. Explicit learning policies when a real second subject needs different
   behavior; preserve Spanish behavior.
2. Browser/device coverage, measured bundle limits and dead-code checks where
   they address actual risks. Keep the existing full gate and coverage floors.

## Product work to evaluate

| Area                                                         | Entry point; verify remaining work against source                                                                                                                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editorial review and broader content                         | [content guide](../apps/linguastein/docs/content-authoring.md), [dataset expansion](../apps/linguastein/docs/tasks/dataset-expansion.md)                                                                         |
| Canonical audio generation, licensing and listening approval | [canonical audio](../apps/linguastein/docs/tasks/canonical-audio.md)                                                                                                                                             |
| More passages and higher-level missions                      | [passage practice](../apps/linguastein/docs/tasks/passage-practice.md), [more missions](../apps/linguastein/docs/tasks/more-missions.md)                                                                         |
| Verb depth, non-item drills and mastery                      | [verb cards](../apps/linguastein/docs/tasks/verb-cards.md), [numerals](../apps/linguastein/docs/tasks/numerals.md)                                                                                               |
| Typed production and diagnostic evidence                     | [typed production](../apps/linguastein/docs/tasks/typed-production.md), [retrieval evidence](../apps/linguastein/docs/tasks/retrieval-evidence.md)                                                               |
| Additional languages and pack resolution                     | [second language](../apps/linguastein/docs/tasks/second-language.md), [language matrix](../apps/linguastein/docs/tasks/language-matrix.md), [pack addressing](../apps/linguastein/docs/tasks/pack-addressing.md) |
| Interaction polish, offline/install UX and raster PWA icons  | [game feel](../apps/linguastein/docs/tasks/game-feel.md), [architecture](../apps/linguastein/docs/architecture.md)                                                                                               |

These are candidate work areas, not a promise that every historical brief is
unimplemented. Keep content generation distinct from human editorial approval.

## Future directions; not immediate implementation

- **Other learning apps:** a hands/pencils rhythm trainer is being considered.
  [Framework](framework.md) defines the reusable core and first timing/input slice;
  [skeleton](skeleton.md) covers scaffolding.
- **Users, registration and sync:** guest access remains available. PHP 8.5+
  is likely; SQLite, MySQL, MariaDB and PostgreSQL are candidates. No vendor,
  auth method or database is fixed. [Server foundation](server-foundation.md)
  owns identity, guest adoption, account switching, HTTP and SQL requirements.
- **Native distribution:** [native-port](../apps/linguastein/docs/tasks/native-port.md) is a historical
  investigation; verify device APIs, hosting and distribution/licensing rules
  when selecting this work.
- **Commercial features:** [monetisation](../apps/linguastein/docs/tasks/monetisation.md) is a historical
  product brief, not an active implementation commitment.

Social features, moderation, a generic plugin/package platform and an AI tutor
remain unimplemented possibilities. Select concrete needs before extending the
base. Task briefs and `spec/` retain rationale; use headings/search to load only
relevant sections, and correct stale status before resuming a brief.
