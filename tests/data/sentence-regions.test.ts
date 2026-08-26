/**
 * A sentence's regions are the *narrowest* claim on it, not every claim at once.
 *
 * `regions` says where a wording is the usual one, and the build assembles it
 * from three places: what the row declares, the regional nouns it uses, and the
 * address form (`vosotros` is Spain's). Those are limits, and two limits on one
 * sentence are both true — so they intersect. They used to be unioned, which
 * *widened* the claim: a row declared `es-419` that reached for a Spain-only noun
 * shipped saying it was the usual wording in both, and a learner filtering Browse
 * to `es-419` would be shown Spain's word for something. The comment at the call
 * site already said "limits"; the code said otherwise and nothing compared them.
 *
 * Two halves are asserted here, and only the third needs the scratch pack. The
 * first two read the shipped files, because "does anything ship a contradiction"
 * is a question about the pack rather than about the build.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createScratchPack, shippedRecords, type ScratchPack } from '../fixtures/dataset';

interface Item {
  readonly text: string;
  readonly regions?: readonly string[];
  readonly address?: string;
  readonly lexemes?: readonly string[];
}

interface Lexeme {
  readonly id: string;
  readonly lemma: string;
  readonly regions?: readonly string[];
}

const sentences = shippedRecords<Item>('sentences');
const nounRegions = new Map(
  shippedRecords<Lexeme>('nouns')
    .filter((noun) => noun.regions?.length)
    .map((noun) => [noun.id, { lemma: noun.lemma, regions: noun.regions! }]),
);

/** Every regional claim on one sentence, as the build sees them. */
function claimsOn(item: Item): { source: string; regions: readonly string[] }[] {
  const claims = (item.lexemes ?? []).flatMap((id) => {
    const noun = nounRegions.get(id);
    return noun ? [{ source: noun.lemma, regions: noun.regions }] : [];
  });
  // `vosotros` is the only address form that narrows anything — see
  // `regionsForAddress` in `src/languages/es/index.ts`.
  if (item.address === 'vosotros') claims.push({ source: 'vosotros', regions: ['es-ES'] });
  return claims;
}

/** What all of them agree on. Empty means they contradict each other. */
function shared(claims: readonly { regions: readonly string[] }[]): readonly string[] {
  if (claims.length === 0) return [];
  return claims
    .slice(1)
    .reduce<readonly string[]>(
      (kept, claim) => kept.filter((region) => claim.regions.includes(region)),
      claims[0]!.regions,
    );
}

describe('the regions a sentence ships with', () => {
  it('never claims a region one of its own words rules out', () => {
    const widened = sentences.filter((item) => {
      const claims = claimsOn(item);
      if (claims.length === 0 || !item.regions?.length) return false;
      return item.regions.some((region) => claims.some((claim) => !claim.regions.includes(region)));
    });

    expect(
      widened.map((item) => `${item.text} → ${item.regions?.join(', ')}`),
      'a region here is a limit, so combining two of them can only narrow — a sentence ' +
        'listing a region that one of its regional words excludes is being offered to a ' +
        'learner whose Spanish it is not',
    ).toEqual([]);
  });

  it('ships no sentence whose regional words share no region at all', () => {
    // The contradiction case. An empty intersection is not a narrower answer, and
    // `[]` on the record would read as "used everywhere" — the opposite of what
    // two disjoint claims say. So the build refuses; this is the pack side of it.
    const contradictory = sentences.filter((item) => {
      const claims = claimsOn(item);
      return claims.length >= 2 && shared(claims).length === 0;
    });

    expect(contradictory.map((item) => item.text)).toEqual([]);
  });

  describe('the build', () => {
    let pack: ScratchPack;

    beforeAll(() => {
      pack = createScratchPack('linguastein-sentence-regions');
    }, 120_000);

    afterAll(() => {
      pack.dispose();
    });

    it('refuses a sentence that mixes wording from regions which do not overlap', () => {
      // `plata` is Latin America's and `ordenador` is Spain's, so there is no
      // learner this sentence is right for. One like it shipped as a claim to
      // both regions at once, which is exactly what the union hid.
      pack.append(
        'sentences-more-coverage.tsv',
        [
          'Compré un ordenador con la plata del verano.',
          'I bought a computer with the summer money.',
          'a2',
          'shopping',
        ].join('\t'),
      );

      const { ok, output } = pack.tryBuild();
      expect(ok).toBe(false);
      expect(output).toContain('Regional conflicts');
      expect(output).toContain('ordenador');
    });
  });
});
