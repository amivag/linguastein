/**
 * The language modules the build can load, by tag.
 *
 * Dynamic `import()` rather than a static map of every module, and that is the
 * whole point of the registry: building German must not load Spanish. A static
 * table would pull `conjugation.ts`, `irregulars.ts` and `numerals.ts` into
 * every build regardless of the tag, and the promise in
 * `docs/tasks/language-matrix.md` — "builds `core-de` with no Spanish module
 * loaded" — would be untestable and untrue.
 *
 * A tag with no case below is **not** an error. It builds a pack of whatever the
 * sources hold with nothing derived: no verb paradigms, no plurals, no numeral
 * skills, no letter-name check. That is the honest first state of a new language
 * and the cheapest way to get its sentences in front of a learner, and it is why
 * every capability on {@link LanguageModule} is optional.
 *
 * The `switch` is the only list of implemented languages. A `Set` beside it read
 * better and was worse: the two could disagree, and it made `default` a branch
 * nothing could reach, so the case that actually matters — a language with no
 * module — was untestable through the door every caller uses.
 */

import type { LanguageModule } from './types';
import { baseLanguage, type LanguageTag } from '../domain/content/language';

export type { LanguageModule } from './types';
export type {
  AlphabetSupport,
  GeneratedForm,
  NominalSupport,
  NumeralSkill,
  NumeralSupport,
  VerbSupport,
} from './types';

export async function languageModule(tag: LanguageTag): Promise<LanguageModule> {
  // One case per tag rather than a template literal, so the bundler can see the
  // targets and a tag can never reach `import()` as an arbitrary path. `es-MX`
  // resolves through `baseLanguage` — an accent is not a different grammar.
  switch (baseLanguage(tag)) {
    case 'es': {
      const { spanish } = await import('./es/index');
      return spanish;
    }
    default:
      return { tag };
  }
}
