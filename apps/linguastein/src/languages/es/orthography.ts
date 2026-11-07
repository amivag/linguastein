/**
 * How Spanish spells itself into an ASCII id.
 *
 * Lexeme and form ids are built from a lemma reduced to `[a-z0-9-]`, and that
 * reduction is the id scheme's — every pack does it the same way. What is *not*
 * shared is which letters a language refuses to lose on the way, and that
 * decision used to sit in `scripts/build-dataset.ts` as a Spanish regex in a
 * file that is meant to build any language. `docs/tasks/language-matrix.md` §1
 * is the brief: German folds `ä ö ü ß` to `ae oe ue ss` because that is German's
 * own convention, Greek and Chinese romanise, and a language whose module says
 * nothing gets the bare ASCII fold — which for a non-Latin script is an empty
 * stem, and the build refuses it rather than issuing one id to every word.
 *
 * Spanish's answer is one rule, and it is worth the file for the bug it records.
 */

/**
 * `ñ` → `nn`, before anything strips a diacritic.
 *
 * The ASCII fold cannot tell a tilde from an acute, so folding `ñ` away made
 * `año` into `ano` — a different word entirely — and collided the letter name
 * `eñe` with `ene`. Nothing failed: `lexemeId` suffixed the second claimant and
 * the *form* ids had no such guard, so the pack shipped one letter's plural under
 * the other's id. `nn` rather than `n` is what keeps nineteen lemmas distinct
 * from their tilde-less near-twins, including the pairs no content has reached
 * yet (`caña`/`cana`, `peña`/`pena`).
 *
 * The accents themselves are deliberately *not* preserved. `té`/`te` and
 * `él`/`el` do collide, and `content/es/stem-collisions.tsv` records all eight
 * pairs rather than fixing them: those ids are permanent and learner mastery is
 * keyed on them. That file is a record of history, not a backlog — a new language
 * fixes the same accident here instead.
 */
export function transliterate(text: string): string {
  return text.normalize('NFC').replace(/[ñÑ]/g, 'nn');
}
