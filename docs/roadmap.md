# Roadmap

Tracks the v0.1 requirements in §28 of the spec against what exists today.

## In place

- React / TypeScript / Vite PWA foundation
- Dataset abstraction: catalog → manifest → JSONL records → validated pack
- Validation boundary + `npm run validate:data`
- Normalised content repository with filters, facets and translation fallback
- Exercise engine: listen & repeat, reveal, think & say, multiple choice,
  cloze choice, tap to build
- Session planner: filters, sequential / random / smart ordering, item- and
  time-based sizing, seeded determinism
- Progress model + interval scheduler behind a `Scheduler` seam
- IndexedDB storage with an in-memory fallback and identical contract tests
- Audio service with pre-generated-audio-first resolution and a TTS seam
- Copy / share, including "copy as AI prompt"
- Mobile-first UI: home, session, settings
- Reference-language architecture (English is the first, not the only)

## Next

1. **Study mode for flashcards** — free browsing with previous/next, order
   toggle and no scoring, separate from tracked practice sessions.
2. **Session filters in the UI** — level, topic, verb and "due only" are
   supported by the planner but not yet exposed.
3. **Canonical audio pipeline** — generate → review → approve → store, plus the
   `audio/<locale>/` layout in packs. Until then the app uses device speech.
4. **Verb practice depth** — surface `VerbForm` records directly (person and
   tense drills), not only cloze inside sentences.
5. **Offline dataset caching** — verify precache coverage and add a visible
   "available offline" state.
6. **Icons** — replace the SVG-only PWA icons with rasterised 192/512 PNGs.

## Later (architecture allows, code does not attempt)

Spaced repetition proper · skill-level mastery inference · contextual content
(dialogues, micro-stories) · story mode · speech recognition and pronunciation
scoring · AI tutor behind an `AiTutorProvider` · community submissions and
review flow · cloud sync behind `LearnerStorage` · translation packs beyond
English.

## Explicitly out of scope for now

Backend, accounts, social features, moderation, native app, app-store pipeline,
gamification, a complete grammar course, and the production dataset itself.
