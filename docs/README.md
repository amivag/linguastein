# Documentation map

Start with [AGENTS.md](../AGENTS.md). Read only the topic needed for the change.
[Current state](current-state.md) is the concise durable project memory.

Platform and repository docs live here; each app keeps its own docs beside its
code. Spanish lives in [`apps/linguastein/docs/`](../apps/linguastein/docs/).

## Platform and repository

| Question                                        | Source                                       |
| ----------------------------------------------- | -------------------------------------------- |
| Palettes and appearance axes                    | [theming.md](theming.md)                     |
| Scaffold another application                    | [skeleton.md](skeleton.md)                   |
| Reuse the learning core; rhythm direction       | [framework.md](framework.md)                 |
| Future PHP/SQL, registration, accounts and sync | [server-foundation.md](server-foundation.md) |
| Product work and historical task entry points   | [roadmap.md](roadmap.md)                     |
| Hosting and base paths                          | [deploy.md](deploy.md)                       |

## Linguastein (Spanish)

| Question                                       | Source                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| Architecture, composition and caching          | [architecture.md](../apps/linguastein/docs/architecture.md)                  |
| Screens, routes, URL codecs                    | [screens-and-urls.md](../apps/linguastein/docs/screens-and-urls.md)          |
| Learning behavior and release conventions      | [working-conventions.md](../apps/linguastein/docs/working-conventions.md)    |
| Authoring content                              | [content-authoring.md](../apps/linguastein/docs/content-authoring.md)        |
| Local transactions, retries and write feedback | [storage.md](../apps/linguastein/docs/storage.md)                            |
| Content record formats                         | [dataset-format.md](../apps/linguastein/docs/dataset-format.md)              |
| UI design and live examples                    | [design-language.md](../apps/linguastein/docs/design-language.md), `/design` |

## Current versus historical

Source and tests describe implemented behavior. Current topic docs describe its
constraints; `current-state.md` records durable decisions and unresolved findings.
Read task briefs in `tasks/` folders only for their specific work, checking their status
and verifying claims against code. Completed-stage narratives, old stack surveys
and `spec/` are historical rationale, not an instruction to implement old plans.
`.audit/` contains dated review evidence. Git history retains superseded text.

Use headings/search and bounded reads rather than loading all docs. Do not keep
parallel memory files or reproduce this index in agent instructions. Avoid fixed
line counts, source-size percentages and transient package/audit inventories.
Replace stale decisions in place; link detail from one owner.

[CHANGELOG.md](../apps/linguastein/CHANGELOG.md) records shipped app changes;
[CONTRIBUTING.md](../CONTRIBUTING.md) owns contribution requirements.
