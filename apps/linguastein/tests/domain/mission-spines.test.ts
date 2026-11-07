/**
 * A mission's curriculum half is shared; only its realisation is Spanish.
 *
 * `MissionDefinition.id` was already documented as independent of a pack and
 * `passage` was already a local id resolved against whichever pack is loaded — so
 * a mission was always a spine plus per-language references, with `language` the
 * one field that forced a duplicate. These tests hold the split honest: that the
 * spine names nothing about Spanish, that a realisation lines up with the ladder
 * it realises, and that an override earns its place.
 *
 * The line-count saving is small — the response palettes are the bulk of the data
 * and are irreducibly per-language, since a nuance like "the same request in tú"
 * describes one Spanish sentence. What is saved is the sequencing: which mission
 * comes first, what each aims at, and the guided-to-independent arc. See
 * `docs/tasks/language-matrix.md` §4.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MISSIONS, MISSION_SPINES, SPANISH_MISSIONS } from '../../src/app/missions';
import { missionTransfers, resolveMissions } from '../../src/domain/missions';

const repoRoot = process.cwd();

const capabilityRegistry = new Set(
  readFileSync(join(repoRoot, 'content/capabilities.tsv'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0 && !line.startsWith('#'))
    .map((line) => line.split('\t')[0]!),
);

/**
 * Spanish orthography and the pronouns Spanish forces a choice between. A neutral
 * string cannot contain either — which is the same ratchet the shared capability
 * registry uses, for the same reason.
 */
const NAMES_SPANISH = /[áéíóúñ¿¡«»]|\b(usted|ustedes|vosotros)\b/i;

describe('the neutral spine', () => {
  it('names nothing about the language it is realised in', () => {
    for (const spine of MISSION_SPINES) {
      // `café` is an English word too, so the title check would false-positive on
      // it. Testing the fields that carry sentences is the part that matters.
      expect(spine.goal, spine.id).not.toMatch(NAMES_SPANISH);
      expect(spine.scenarioPartner, spine.id).not.toMatch(NAMES_SPANISH);
      for (const [index, rung] of (spine.ladder ?? []).entries()) {
        expect(rung.brief, `${spine.id} rung ${index}`).not.toMatch(NAMES_SPANISH);
      }
    }
  });

  it('draws every capability from the shared registry', () => {
    // A spine claiming a capability no language could cover is a curriculum
    // fiction. The registry is the vocabulary both halves have to agree on.
    for (const spine of MISSION_SPINES) {
      for (const capability of spine.capabilities ?? []) {
        expect(capabilityRegistry, `${spine.id}/${capability}`).toContain(capability);
      }
    }
  });

  it('gives every spine a distinct id and a distinct place in the order', () => {
    const ids = MISSION_SPINES.map((spine) => spine.id);
    expect(new Set(ids).size).toBe(ids.length);
    const orders = MISSION_SPINES.map((spine) => spine.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('ends every ladder independent, because that is what transfer means', () => {
    for (const spine of MISSION_SPINES) {
      const ladder = spine.ladder ?? [];
      expect(ladder.length, spine.id).toBeGreaterThan(0);
      expect(ladder.at(-1)?.support, spine.id).toBe('independent');
    }
  });
});

describe('the Spanish realisation', () => {
  it('realises a spine that exists', () => {
    const spines = new Set(MISSION_SPINES.map((spine) => spine.id));
    for (const realisation of SPANISH_MISSIONS) {
      expect(spines, realisation.mission).toContain(realisation.mission);
    }
  });

  it('supplies exactly one passage per rung of its spine', () => {
    // `rungs` is index-aligned with `ladder`, so a length disagreement is a bug
    // rather than a shorter ladder: `resolveMissions` would silently drop the
    // unmatched rungs and the mission would lose a transfer context.
    const ladders = new Map(MISSION_SPINES.map((spine) => [spine.id, spine.ladder ?? []]));
    for (const realisation of SPANISH_MISSIONS) {
      expect(realisation.rungs?.length ?? 0, realisation.mission).toBe(
        ladders.get(realisation.mission)?.length ?? 0,
      );
    }
  });

  it('overrides a brief only where the neutral one cannot carry it', () => {
    const ladders = new Map(MISSION_SPINES.map((spine) => [spine.id, spine.ladder ?? []]));
    const overridden: string[] = [];

    for (const realisation of SPANISH_MISSIONS) {
      for (const [index, rung] of (realisation.rungs ?? []).entries()) {
        if (rung.brief === undefined) continue;
        // Restating the neutral brief is how the spine quietly stops being the
        // source — the same failure the capability registry's gate exists for.
        expect(rung.brief, `${realisation.mission} rung ${index}`).not.toBe(
          ladders.get(realisation.mission)?.[index]?.brief,
        );
        overridden.push(`${realisation.mission}/${index}`);
      }
    }

    // Two of fifty-one, both because the formal/informal pronoun *is* the
    // situation. If this list grows, the neutral briefs are what to fix.
    expect(overridden).toEqual(['greet-and-respond/1', 'make-yourself-understood/1']);
  });

  it('keeps its palettes describing Spanish, which is why they are not shared', () => {
    // Not a complaint: a nuance names one sentence's tone, so it belongs with the
    // language. This asserts the split put them on the right side of the line.
    const nuances = SPANISH_MISSIONS.flatMap((realisation) =>
      (realisation.responsePalettes ?? []).flatMap((palette) =>
        palette.responses.map((response) => response.nuance),
      ),
    );
    expect(nuances.length).toBeGreaterThan(500);
    // `\b` does not fire after `ú`, which is not a word character — hence the
    // explicit "not followed by a letter" rather than a trailing boundary.
    expect(nuances.some((nuance) => /\bt[uú](?![\wáéíóúñ])/i.test(nuance))).toBe(true);
  });
});

describe('the join', () => {
  it('produces the shape every screen already reads', () => {
    // The point of returning `MissionDefinition` rather than a new type: the
    // split is about where data is authored, and no consumer has an opinion.
    expect(MISSIONS).toHaveLength(SPANISH_MISSIONS.length);
    for (const mission of MISSIONS) {
      expect(mission.language).toBe('es');
      expect(missionTransfers(mission)).toHaveLength(3);
      expect(mission.capabilities?.length, mission.id).toBeGreaterThan(0);
      expect(mission.responsePalettes?.length, mission.id).toBeGreaterThan(0);
    }
  });

  it('drops a realisation whose spine is missing rather than throwing', () => {
    // A missing curriculum entry must not take the app down. The tests above are
    // where it becomes an error instead.
    const orphan = { ...SPANISH_MISSIONS[0]!, mission: 'no-such-spine' };
    expect(resolveMissions(MISSION_SPINES, [orphan])).toEqual([]);
  });

  it('prefers a realisation brief over the spine default, per rung', () => {
    const greet = MISSIONS.find((mission) => mission.id === 'greet-and-respond');
    const rungs = missionTransfers(greet!);
    expect(rungs[1]?.brief).toContain('usted');
    // …and leaves the neutral one in place where nothing overrode it.
    expect(rungs[0]?.brief).not.toMatch(NAMES_SPANISH);
  });
});
