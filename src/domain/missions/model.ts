/**
 * A mission is curriculum sequencing, not an exercise or a copy of content.
 *
 * It points at connected passages and says what communicative outcome that
 * material serves. Each passage keeps owning its sentences; the exercise engine
 * keeps deriving practice from them; learner progress keeps pointing only at
 * item ids. A mission merely turns those existing systems into a journey.
 */

import { CEFR_LEVELS, LEVEL_SCOPE_ALL, type CefrLevel, type Course } from '../content';

export const MISSION_STAGES = ['understand', 'practise', 'use'] as const;
export type MissionStage = (typeof MISSION_STAGES)[number];

export type MissionTransferSupport = 'guided' | 'independent';

export interface MissionTransfer {
  /** Local passage id for this distinct real-world context. */
  readonly passage: string;
  /** Guided gives line-level meaning cues; independent gives intention cues. */
  readonly support: MissionTransferSupport;
  /** Short learner-facing explanation of what changed in this context. */
  readonly brief: string;
}

export interface MissionResponseOption {
  /** Local item id of an ordinary sentence that can perform this move. */
  readonly item: string;
  /** Brief pragmatic distinction: tone, strength, emotion or setting. */
  readonly nuance: string;
}

export interface MissionResponsePalette {
  readonly id: string;
  /** Communicative-function skill shared by the turns this palette can answer. */
  readonly capability: string;
  /** Prompt used instead of prescribing one English translation in Use. */
  readonly cue: string;
  readonly title: string;
  readonly responses: readonly MissionResponseOption[];
  /** Number shown before the learner asks to expand the palette. */
  readonly initiallyVisible?: number;
}

export interface MissionDefinition {
  /** Stable, shareable curriculum id — deliberately independent of a pack id. */
  readonly id: string;
  readonly language: string;
  readonly level: CefrLevel;
  readonly order: number;
  readonly title: string;
  /** The real-world thing the learner should be able to do afterwards. */
  readonly goal: string;
  /** Local passage id, resolved against whichever compatible pack is loaded. */
  readonly passage: string;
  /**
   * A parallel situation used only for transfer after practice. It recombines
   * the same useful language so Use is not an exact replay of Understand.
   */
  readonly challengePassage?: string;
  /**
   * An ordered ladder of transfer contexts. Earlier rungs change details;
   * later rungs reduce scripting and ask the learner to recombine the skill.
   */
  readonly transfers?: readonly MissionTransfer[];
  /** Local ids of communicative-function skills this mission gathers evidence for. */
  readonly capabilities?: readonly string[];
  /** Natural alternatives for one communicative move, never exercise records. */
  readonly responsePalettes?: readonly MissionResponsePalette[];
  /** Which line gives Home a useful preview. */
  readonly spotlight: number;
  readonly estimatedMinutes: number;
  /** In a dialogue, the part the learner performs during the Use stage. */
  readonly learnerSpeaker?: string;
  /** What to call the other side when the source is a monologue or narrative. */
  readonly scenarioPartner: string;
}

/**
 * One rung of the transfer ladder, as the curriculum declares it.
 *
 * `support` and `brief` are the pedagogy — how much scaffolding this rung gives
 * and what changed about the situation — and neither is a fact about a language.
 * Which passage realises the rung is (see {@link MissionRungRealisation}).
 */
export interface MissionRung {
  readonly support: MissionTransferSupport;
  /**
   * Neutral description of what changed. A language may override it where it
   * cannot stay neutral: two of the shipped fifty-one name `tú` or `usted`,
   * which is the whole point of the rung and meaningless in English.
   */
  readonly brief: string;
}

/**
 * A mission with the language taken out of it: what it is for, in what order,
 * aiming at which capabilities, with what transfer arc.
 *
 * This half is the reusable one. `MissionDefinition.id` was already documented
 * as independent of a pack, and `passage` was already a *local* id resolved
 * against whichever compatible pack is loaded — so a mission was always a spine
 * plus per-language references, with `language` the field that forced a
 * duplicate. Authoring a second language's missions is now choosing passages,
 * not re-deriving the sequencing.
 *
 * The prose here — `title`, `goal`, `scenarioPartner`, a rung's `brief` — is
 * neutral about the *target* language and still written in English. A learner
 * who does not read English needs it translated, which puts it with the UI
 * chrome rather than with the content. See `docs/tasks/language-matrix.md` §4.
 */
export interface MissionSpine {
  /** Stable, shareable curriculum id — deliberately independent of a pack id. */
  readonly id: string;
  readonly order: number;
  readonly title: string;
  /** The real-world thing the learner should be able to do afterwards. */
  readonly goal: string;
  /** What to call the other side when the source is a monologue or narrative. */
  readonly scenarioPartner: string;
  /** Communicative-function capabilities this mission gathers evidence for. */
  readonly capabilities?: readonly string[];
  readonly estimatedMinutes: number;
  /**
   * The transfer arc: earlier rungs change details, later rungs reduce scripting.
   * A language supplies one passage per rung, in this order.
   */
  readonly ladder?: readonly MissionRung[];
}

/** Which passage realises one rung, and a brief where the neutral one will not do. */
export interface MissionRungRealisation {
  /** Local passage id for this distinct real-world context. */
  readonly passage: string;
  readonly brief?: string;
}

/**
 * How one language realises one spine.
 *
 * `rungs` is index-aligned with the spine's `ladder`, the way `Passage.speakers`
 * is index-aligned with its `items`: the ladder is ordered and that order is its
 * meaning, so a key per rung would name what the position already says. A
 * realisation whose length disagrees with its spine is a bug rather than a
 * shorter ladder, and `tests/domain/mission-spines.test.ts` is what says so.
 *
 * `level` is here rather than on the spine deliberately. Grading does not
 * transfer — the same capability is not the same difficulty in two languages —
 * which is the finding `docs/tasks/language-matrix.md` §4 records.
 */
export interface MissionRealisation {
  /** The spine this realises, by {@link MissionSpine.id}. */
  readonly mission: string;
  readonly language: string;
  readonly level: CefrLevel;
  /** Local passage id, resolved against whichever compatible pack is loaded. */
  readonly passage: string;
  /** Which line gives Home a useful preview. */
  readonly spotlight: number;
  /** In a dialogue, the part the learner performs during the Use stage. */
  readonly learnerSpeaker?: string;
  readonly rungs?: readonly MissionRungRealisation[];
  /** Natural alternatives for one communicative move, never exercise records. */
  readonly responsePalettes?: readonly MissionResponsePalette[];
}

/**
 * Joins spines to realisations, producing the shape every screen already reads.
 *
 * Deliberately returns {@link MissionDefinition} rather than a new type: the
 * split is about where the data is *authored*, and nothing downstream — the
 * planner, Home, `MissionScreen`, the search chain — has an opinion about that.
 * A realisation naming a spine that does not exist is dropped rather than
 * throwing, because a missing curriculum entry must not take the app down; the
 * test suite is where that becomes an error.
 */
export function resolveMissions(
  spines: readonly MissionSpine[],
  realisations: readonly MissionRealisation[],
): readonly MissionDefinition[] {
  const bySpine = new Map(spines.map((spine) => [spine.id, spine]));

  return realisations.flatMap((realisation) => {
    const spine = bySpine.get(realisation.mission);
    if (!spine) return [];

    const ladder = spine.ladder ?? [];
    const transfers = ladder.flatMap((rung, index) => {
      const realised = realisation.rungs?.[index];
      if (!realised) return [];
      return [
        {
          passage: realised.passage,
          support: rung.support,
          brief: realised.brief ?? rung.brief,
        },
      ];
    });

    return [
      {
        id: spine.id,
        language: realisation.language,
        level: realisation.level,
        order: spine.order,
        title: spine.title,
        goal: spine.goal,
        passage: realisation.passage,
        ...(transfers.length ? { transfers } : {}),
        ...(spine.capabilities ? { capabilities: spine.capabilities } : {}),
        ...(realisation.responsePalettes ? { responsePalettes: realisation.responsePalettes } : {}),
        spotlight: realisation.spotlight,
        estimatedMinutes: spine.estimatedMinutes,
        ...(realisation.learnerSpeaker ? { learnerSpeaker: realisation.learnerSpeaker } : {}),
        scenarioPartner: spine.scenarioPartner,
      },
    ];
  });
}

export function missionPassageForStage(mission: MissionDefinition, stage: MissionStage): string {
  return stage === 'use'
    ? (missionTransfers(mission)[0]?.passage ?? mission.passage)
    : mission.passage;
}

/** The authored ladder, with the original single challenge kept as a fallback. */
export function missionTransfers(mission: MissionDefinition): readonly MissionTransfer[] {
  if (mission.transfers?.length) return mission.transfers;
  return mission.challengePassage
    ? [
        {
          passage: mission.challengePassage,
          support: 'guided',
          brief: 'The details have changed. Use what you learned in this new situation.',
        },
      ]
    : [];
}

/** First unfinished rung; after the ladder is complete, revisit its final challenge. */
export function nextMissionTransfer(
  mission: MissionDefinition,
  completedPassages: ReadonlySet<string>,
):
  | { readonly transfer: MissionTransfer; readonly index: number; readonly total: number }
  | undefined {
  const transfers = missionTransfers(mission);
  if (!transfers.length) return undefined;
  const unfinished = transfers.findIndex((transfer) => !completedPassages.has(transfer.passage));
  const index = unfinished >= 0 ? unfinished : transfers.length - 1;
  return { transfer: transfers[index]!, index, total: transfers.length };
}

/** A mission advances once each named real-world capability has retrieval evidence. */
export function missionCapabilitiesHaveEvidence(
  capabilities: readonly string[],
  evidencedCapabilities: ReadonlySet<string>,
): boolean {
  return (
    capabilities.length > 0 &&
    capabilities.every((capability) => evidencedCapabilities.has(capability))
  );
}

/** Missions that belong in a course, in their authored dependency order. */
export function missionsForCourse(
  catalog: readonly MissionDefinition[],
  course: Course,
): readonly MissionDefinition[] {
  const ceiling =
    course.level === LEVEL_SCOPE_ALL ? Number.POSITIVE_INFINITY : CEFR_LEVELS.indexOf(course.level);

  return catalog
    .filter(
      (mission) =>
        mission.language === course.language && CEFR_LEVELS.indexOf(mission.level) <= ceiling,
    )
    .sort((a, b) => a.order - b.order);
}

/**
 * Every passage a mission reads from, in the order it meets them.
 *
 * One list rather than three reads of `passage`, `challengePassage` and the
 * transfer ladder. The ladder already has two spellings — `transfers` with the
 * single `challengePassage` kept as a fallback — so a caller asking "does this
 * mission use that text" had three fields to remember and one to forget.
 */
export function missionPassages(mission: MissionDefinition): readonly string[] {
  const passages = [mission.passage, ...missionTransfers(mission).map((entry) => entry.passage)];
  return [...new Set(passages)];
}

/**
 * The missions that teach one passage — how a word reaches a mission.
 *
 * Through a passage, because that is the only link there is: a mission names
 * local passage ids and nothing else, so the chain from a searched word runs
 * word → items → passages → here. Local ids for the reason a link carries one:
 * a mission id is curriculum and deliberately independent of any pack.
 */
export function missionsUsingPassage(
  catalog: readonly MissionDefinition[],
  course: Course,
  localPassageId: string,
): readonly MissionDefinition[] {
  return missionsForCourse(catalog, course).filter((mission) =>
    missionPassages(mission).includes(localPassageId),
  );
}

export function missionById(
  catalog: readonly MissionDefinition[],
  course: Course,
  id: string,
): MissionDefinition | undefined {
  return missionsForCourse(catalog, course).find((mission) => mission.id === id);
}

/** Completion stays derived: every sentence in the mission has retrieval evidence. */
export function missionIsComplete(
  itemIds: readonly string[],
  practisedItemIds: ReadonlySet<string>,
): boolean {
  return itemIds.length > 0 && itemIds.every((id) => practisedItemIds.has(id));
}
