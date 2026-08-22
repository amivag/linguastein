/**
 * Comparing what a learner said against what they were asked to say.
 *
 * Deliberately forgiving. A recogniser drops punctuation, mangles accents and
 * guesses at homophones; a learner who says the sentence correctly should not
 * be told they were wrong because the transcript reads "tengo que trabajar"
 * without the full stop. Word-level matching, accent-insensitive, with a
 * "close" band between right and wrong.
 */

import { normalise, splitWords } from '../content';

export type SpeechVerdict = 'match' | 'close' | 'different';

export interface SpeechComparison {
  readonly verdict: SpeechVerdict;
  /** 0–1 share of expected words that were said. */
  readonly score: number;
  /** Expected words the learner did not say, in order. */
  readonly missing: readonly string[];
  /** Words heard that were not expected. */
  readonly extra: readonly string[];
}

const MATCH_THRESHOLD = 0.85;
const CLOSE_THRESHOLD = 0.5;

export function compareSpoken(expected: string, spoken: string): SpeechComparison {
  const expectedWords = words(expected);
  const spokenWords = words(spoken);

  if (expectedWords.length === 0) {
    return { verdict: 'different', score: 0, missing: [], extra: spokenWords };
  }

  const remaining = [...spokenWords];
  const missing: string[] = [];
  let matched = 0;

  for (const word of expectedWords) {
    const index = remaining.indexOf(word);
    if (index === -1) missing.push(word);
    else {
      matched++;
      remaining.splice(index, 1);
    }
  }

  const score = matched / expectedWords.length;
  // Word order matters for meaning, so an exact sequence is required for a
  // clean match; the same words in another order lands in "close".
  const ordered = expectedWords.join(' ') === spokenWords.join(' ');

  return {
    verdict: verdictFor(score, ordered),
    score: Number(score.toFixed(2)),
    missing,
    extra: remaining,
  };
}

function verdictFor(score: number, ordered: boolean): SpeechVerdict {
  if (ordered || score >= MATCH_THRESHOLD) return 'match';
  if (score >= CLOSE_THRESHOLD) return 'close';
  return 'different';
}

/**
 * Picks the recogniser alternative that best matches what was expected. Engines
 * often rank a plausible English reading above the correct Spanish one.
 */
export function bestAlternative(
  expected: string,
  transcript: string,
  alternatives: readonly string[] = [],
): { text: string; comparison: SpeechComparison } {
  const candidates = [transcript, ...alternatives];
  let best = { text: transcript, comparison: compareSpoken(expected, transcript) };

  for (const candidate of candidates.slice(1)) {
    const comparison = compareSpoken(expected, candidate);
    if (comparison.score > best.comparison.score) best = { text: candidate, comparison };
  }

  return best;
}

export interface ExpectedSpeechMatch {
  readonly expected: string;
  readonly text: string;
  readonly comparison: SpeechComparison;
}

/**
 * Finds the recognised phrase and valid response that agree best.
 *
 * A response palette can contain genuinely different sentences, so comparing
 * every recogniser hypothesis only with one canonical line would reject a
 * perfectly appropriate answer before the curriculum could credit it.
 */
export function bestExpectedAlternative(
  expected: readonly string[],
  transcript: string,
  alternatives: readonly string[] = [],
): ExpectedSpeechMatch {
  const targets = expected.length ? expected : [''];
  let best: ExpectedSpeechMatch = {
    expected: targets[0]!,
    text: transcript,
    comparison: compareSpoken(targets[0]!, transcript),
  };

  for (const target of targets) {
    for (const candidate of [transcript, ...alternatives]) {
      const comparison = compareSpoken(target, candidate);
      if (
        comparison.score > best.comparison.score ||
        (comparison.score === best.comparison.score &&
          verdictRank(comparison.verdict) > verdictRank(best.comparison.verdict))
      ) {
        best = { expected: target, text: candidate, comparison };
      }
    }
  }

  return best;
}

function verdictRank(verdict: SpeechVerdict): number {
  if (verdict === 'match') return 2;
  return verdict === 'close' ? 1 : 0;
}

function words(text: string): readonly string[] {
  return splitWords(normalise(text));
}
