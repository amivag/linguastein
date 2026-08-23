# Design QA — Mission Home

## Capture metadata

- selected visual target: `C:\Users\amiev\.codex\generated_images\01a02853-07b2-7670-ab89-66edc7fffe76\exec-d406194f-b482-4e53-91c1-bf0ab6d97fa5.png`
- source pixels: 853 × 1844
- implementation capture: `C:\evan\dev\my-projects\linguastein\.audit\2026-08-22-mission-home\implementation-final.png`
- captured pixels: 380 × 822
- CSS viewport: 390 × 844
- device pixel ratio: 1.75
- comparison: both captures normalized to 390 × 844 and placed side by side in `.audit/2026-08-22-mission-home/comparison-final.png`
- route: `http://localhost:5173/linguastein/es/a1`
- theme: resolved dark theme through the app's system setting

## Comparison result

The implementation preserves the selected concept's hierarchy: course header, one dominant real-world mission, phrase and meaning, mission facts, a single primary action, three-stage learning path, non-punitive weekly rhythm, free-practice escape hatch, and persistent bottom navigation. It uses the existing design system and live Spanish content rather than copying decorative details or inventing curriculum records.

| Priority | Finding                                                                                                          | Resolution                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| P0       | None                                                                                                             | —                                                                         |
| P1       | None                                                                                                             | —                                                                         |
| P2       | The initial implementation exposed a large course-item count above the mission, weakening the primary hierarchy. | Moved the count into the Free practice sheet beside the course controls.  |
| P2       | The advanced practice disclosure was partially visible behind the fixed navigation at the target viewport.       | Moved it cleanly below the first viewport while preserving scroll access. |

## Functional verification

- “Begin mission · 5 min” opens the real A1 café passage at `/es/a1/read/700009`.
- “Free practice” opens a modal sheet containing course, duration, and practice-mode controls.
- The browser console contained no warnings or errors during the checked interactions.
- The full accessibility suite passed: 124 tests.
- Responsive capture showed no horizontal overflow; document content width was 380 CSS px inside the browser's 390 px viewport.

final result: passed
