import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { MISSIONS } from '../../app/missions';
import { MISSION_VARIATIONS } from '../../app/mission-variations';
import {
  useCourse,
  usePronunciationLocale,
  useTargetLanguage,
  useVoiceName,
} from '../../app/course';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SectionTabs } from '../../components/SectionTabs';
import { Sheet } from '../../components/Sheet';
import { TokenizedText } from '../../components/TokenizedText';
import { PlaybackTransport } from '../../components/PlaybackTransport';
import { Transcript } from '../../components/Transcript';
import { useSequence } from '../../components/usePlayback';
import { useWordSelection, type WordSelection } from '../../components/useWordSelection';
import { WordInfoSheet } from '../../components/WordInfoSheet';
import {
  isMissionUseSession,
  missionById,
  missionTransfers,
  missionUseSessionId,
  nextMissionTransfer,
  type MissionStage,
  type MissionTransferSupport,
} from '../../domain/missions';
import { languageOption, type ItemId, type LearningItem, type SkillId } from '../../domain/content';
import {
  defaultVariationSelections,
  renderVariation,
  type SpeechComparison,
  type VariationPattern,
} from '../../domain/exercises';
import {
  inferMastery,
  recordAttempt,
  type MasteryRecord,
  type ReviewGrade,
} from '../../domain/progress';
import { SpeakCheck } from '../practice/SpeakCheck';
import { studyPath } from '../study/study-url';
import { MissionJourney } from './MissionJourney';
import {
  missionJourneyHrefs,
  missionPath,
  missionPracticePath,
  parseMissionSection,
  type MissionSection,
} from './mission-url';
import styles from './Mission.module.css';

interface MissionCapability {
  readonly id: SkillId;
  readonly label: string;
  readonly evidence?: MasteryRecord;
}

interface ResolvedResponsePalette {
  readonly id: string;
  readonly capability: SkillId;
  readonly title: string;
  readonly cue: string;
  readonly initiallyVisible: number;
  readonly responses: readonly {
    readonly item: LearningItem;
    readonly meaning?: string;
    readonly nuance: string;
  }[];
}

/** The reusable Understand → Practise → Use journey over one connected passage. */
export function MissionScreen() {
  const { missionId = '', stage = 'understand' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { course, filter, option, ladder } = useCourse();
  // Every reference on this screen is a curriculum one — a passage, a skill, a
  // palette's item — so all of them resolve inside this language's packs.
  const packs = filter.packs;
  const { services, preferences } = useServices();
  const locale = usePronunciationLocale();
  const voice = useVoiceName();
  // Named once for the copy that has to say which language a learner is being
  // asked to respond in. `Respond naturally … in Spanish` was the fallback cue
  // on every mission whose turns declare no communicative function.
  const courseLanguageName = languageOption(course.language).englishName;
  const mission = missionById(MISSIONS, course, missionId, ladder);
  const chosenStage: MissionStage = stage === 'use' ? 'use' : 'understand';
  /**
   * Which rung of the ladder the Use stage is on: `undefined` until the attempt
   * log has been read, `null` when there is no ladder.
   *
   * The answer is stored with the mission it answers *for*, and "not known yet"
   * is derived from the two disagreeing rather than written by a reset. Writing
   * it was the older shape and a real hazard: a `setState` in an effect body
   * renders once with the previous mission's rung before the reset lands, and
   * the rung decides which passage the whole screen shows.
   */
  const [resolvedTransfer, setResolvedTransfer] = useState<{
    readonly missionId: string;
    readonly step: ReturnType<typeof nextMissionTransfer> | null;
  } | null>(null);
  const transferStep =
    chosenStage !== 'use'
      ? null
      : resolvedTransfer && resolvedTransfer.missionId === mission?.id
        ? resolvedTransfer.step
        : undefined;
  const passageLocalId = chosenStage === 'use' ? transferStep?.transfer.passage : mission?.passage;
  const requestedPassage = passageLocalId
    ? services.repository.passageByRef(passageLocalId, packs)
    : undefined;
  // A curriculum may run against a compatible pack version that predates its
  // optional transfer passage. Widen to the taught exchange instead of making
  // the whole mission unavailable.
  const passage =
    requestedPassage ??
    (mission ? services.repository.passageByRef(mission.passage, packs) : undefined);
  const isTransfer = requestedPassage !== undefined && passageLocalId !== mission?.passage;
  const items = useMemo(
    () => (passage ? services.repository.itemsOfPassage(passage.id) : []),
    [passage, services.repository],
  );
  const courseIds = useMemo(
    () => new Set(services.repository.query(filter).map((item) => item.id)),
    [filter, services.repository],
  );
  const available = passage !== undefined && items.some((item) => courseIds.has(item.id));
  const [skillMastery, setSkillMastery] = useState<ReadonlyMap<SkillId, MasteryRecord>>(new Map());
  const missionUseSession = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (chosenStage !== 'use' || !mission) return;
    let cancelled = false;
    missionUseSession.current = undefined;
    void services.storage.attempts.recent(10_000).then((attempts) => {
      if (cancelled) return;
      const evidenced = new Set(
        attempts
          .filter((attempt) => isMissionUseSession(attempt.sessionId, mission.id))
          .map((attempt) => attempt.subject),
      );
      const availableTransfers = missionTransfers(mission).filter((transfer) =>
        services.repository.passageByRef(transfer.passage, packs),
      );
      const complete = new Set<string>();
      for (const transfer of availableTransfers) {
        const candidate = services.repository.passageByRef(transfer.passage, packs);
        if (!candidate) continue;
        const learnerItems = services.repository
          .itemsOfPassage(candidate.id)
          .filter(
            (_, index) =>
              mission.learnerSpeaker === undefined ||
              candidate.speakers?.[index] === mission.learnerSpeaker,
          );
        if (learnerItems.length && learnerItems.every((item) => evidenced.has(item.id))) {
          complete.add(transfer.passage);
        }
      }
      setResolvedTransfer({
        missionId: mission.id,
        step: nextMissionTransfer({ ...mission, transfers: availableTransfers }, complete) ?? null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [chosenStage, mission, packs, services]);

  useEffect(() => {
    if (chosenStage === 'use' || !mission?.capabilities?.length) return;
    let cancelled = false;
    void services.storage.progress.all().then((progress) => {
      if (!cancelled) setSkillMastery(inferMastery(services.repository, progress).skills);
    });
    return () => {
      cancelled = true;
    };
  }, [chosenStage, mission, services]);

  const capabilities = useMemo(
    () =>
      (mission?.capabilities ?? []).flatMap((slug): readonly MissionCapability[] => {
        const skill = services.repository.skillByRef(slug, packs);
        if (!skill || skill.kind !== 'function') return [];
        const label =
          services.repository.translationOf(skill.id, preferences.referenceLanguage)?.text ??
          skill.label;
        const evidence = skillMastery.get(skill.id);
        return [{ id: skill.id, label, ...(evidence ? { evidence } : {}) }];
      }),
    [mission, packs, preferences.referenceLanguage, services.repository, skillMastery],
  );
  const responsePalettes = useMemo(
    () =>
      (mission?.responsePalettes ?? []).flatMap((palette): readonly ResolvedResponsePalette[] => {
        const capability = services.repository.skillByRef(palette.capability, packs);
        if (!capability || capability.kind !== 'function') return [];
        const responses = palette.responses.flatMap((response) => {
          const item = services.repository.itemByLocalId(response.item, packs);
          if (!item) return [];
          const meaning = services.repository.translationOf(
            item.id,
            preferences.referenceLanguage,
          )?.text;
          return [
            {
              item,
              nuance: response.nuance,
              ...(meaning ? { meaning } : {}),
            },
          ];
        });
        if (!responses.length) return [];
        return [
          {
            id: palette.id,
            capability: capability.id,
            title: palette.title,
            cue: palette.cue,
            initiallyVisible: Math.max(1, palette.initiallyVisible ?? 3),
            responses,
          },
        ];
      }),
    [mission, packs, preferences.referenceLanguage, services.repository],
  );
  /**
   * Which word is open, held here rather than in the stage that shows it.
   *
   * UnderstandStage and UseStage are declared inside this component, so every
   * render of it gives them a fresh identity and React remounts them — and any
   * state they own goes with it. That is survivable for a toggle, and not for
   * this: the capability query resolves a moment after mount, so a learner who
   * tapped a word promptly watched the sheet vanish before it appeared.
   */
  const words = useWordSelection();
  const variationPatterns = mission ? (MISSION_VARIATIONS[mission.id] ?? []) : [];

  const recordMissionUse = useCallback(
    async (item: LearningItem, grade: ReviewGrade, correct: boolean, latencyMs: number) => {
      if (!mission) return new Map<SkillId, MasteryRecord>();
      const now = Date.now();
      const context = transferStep?.transfer.passage ?? mission.passage;
      const sessionId =
        missionUseSession.current ?? missionUseSessionId(mission.id, context, now.toString(36));
      missionUseSession.current = sessionId;
      const current = await services.storage.progress.get(item.id);
      const recorded = recordAttempt(
        current,
        {
          subject: item.id,
          exerciseKind: 'think-say',
          grade,
          correct,
          latencyMs,
          sessionId,
        },
        now,
      );

      await Promise.all([
        services.storage.progress.put(recorded.progress),
        services.storage.attempts.append(recorded.attempt),
      ]);
      const progress = await services.storage.progress.all();
      return inferMastery(services.repository, progress).skills;
    },
    [mission, services, transferStep],
  );

  if (chosenStage === 'use' && transferStep === undefined) {
    return (
      <AppShell
        title={mission?.title ?? 'Mission'}
        onBack={() => void navigate(studyPath(course, 'missions'))}
        showNav={false}
      >
        <p role="status">Preparing your next transfer challenge…</p>
      </AppShell>
    );
  }

  if (!mission || !passage || !available) {
    return (
      <AppShell
        title="Mission"
        onBack={() => void navigate(studyPath(course, 'missions'))}
        showNav={false}
      >
        <section className={styles.empty}>
          <Icon name="passage" size="xl" />
          <p role="status">
            This mission is not available in {option?.englishLabel ?? 'this course'}. It may need a
            different level, or a pack that is not installed.
          </p>
          {/* To the ladder the button names. `path()` is the course home — Test —
              so "Back to missions" landed on the one screen that is not the
              missions list, which is the same broken promise as a Back button
              that resets the section you were in. */}
          <Button
            variant="primary"
            block
            onClick={() => void navigate(studyPath(course, 'missions'))}
          >
            Back to missions
          </Button>
        </section>
      </AppShell>
    );
  }

  const journeyHrefs = missionJourneyHrefs(course, mission);

  return (
    <AppShell
      title={mission.title}
      onBack={() => void navigate(studyPath(course, 'missions'))}
      showNav={false}
    >
      {chosenStage === 'understand' ? (
        <UnderstandStage
          key={passage.id}
          words={words}
          journeyHrefs={journeyHrefs}
          section={parseMissionSection(params)}
          sectionPath={(chosen) => missionPath(course, mission.id, 'understand', chosen)}
          language={course.language}
          speak={speak}
          speakText={speakText}
          translationOf={translationOf}
          missionId={mission.id}
          missionGoal={mission.goal}
          passageTitle={passage.title}
          capabilities={capabilities}
          responsePalettes={responsePalettes}
          variationPatterns={variationPatterns}
          items={items}
          {...(passage.speakers ? { speakers: passage.speakers } : {})}
          {...(mission.learnerSpeaker ? { learnerSpeaker: mission.learnerSpeaker } : {})}
          onPractise={() => void navigate(missionPracticePath(course, mission))}
        />
      ) : (
        <UseStage
          key={passage.id}
          words={words}
          journeyHrefs={journeyHrefs}
          speak={speak}
          translationOf={translationOf}
          intentionCue={intentionCue}
          missionId={mission.id}
          missionGoal={mission.goal}
          partner={mission.scenarioPartner}
          transfer={isTransfer}
          {...(transferStep?.transfer.brief ? { transferBrief: transferStep.transfer.brief } : {})}
          transferSupport={transferStep?.transfer.support ?? 'guided'}
          transferPosition={(transferStep?.index ?? 0) + 1}
          transferTotal={transferStep?.total ?? 1}
          capabilities={capabilities}
          responsePalettes={responsePalettes}
          {...(mission.learnerSpeaker ? { learnerSpeaker: mission.learnerSpeaker } : {})}
          items={items}
          {...(passage.speakers ? { speakers: passage.speakers } : {})}
          onGrade={recordMissionUse}
          // Out to the mission list, where this mission's row now reads either
          // "Complete" or the transfer you are up to — the screen a learner
          // finishing a stage is trying to get back to. It used to be the course
          // home, which showed them a session instead.
          onFinish={() => void navigate(studyPath(course, 'missions'))}
        />
      )}
    </AppShell>
  );

  function translationOf(item: LearningItem): string | undefined {
    return services.repository.translationOf(item.id, preferences.referenceLanguage)?.text;
  }

  function speak(item: LearningItem) {
    speakText(item.text);
  }

  function intentionCue(item: LearningItem): string {
    const intentions = (item.skills ?? []).flatMap((id) => {
      const skill = services.repository.getSkill(id);
      if (!skill || skill.kind !== 'function') return [];
      return [
        services.repository.translationOf(id, preferences.referenceLanguage)?.text ?? skill.label,
      ];
    });
    return intentions.length
      ? intentions.join(' · ')
      : `Respond naturally to ${mission?.scenarioPartner ?? 'the situation'} in ${courseLanguageName}.`;
  }

  function speakText(text: string) {
    void services.audio.speak({
      text,
      locale,
      ...(voice ? { voice } : {}),
    });
  }
}

function UnderstandStage({
  missionId: id,
  words,
  journeyHrefs,
  section,
  sectionPath,
  language,
  speak,
  speakText,
  translationOf,
  missionGoal,
  passageTitle,
  capabilities: stageCapabilities,
  responsePalettes: stagePalettes,
  variationPatterns: stageVariations,
  items: stageItems,
  speakers,
  learnerSpeaker,
  onPractise,
}: {
  readonly missionId: string;
  readonly missionGoal: string;
  readonly passageTitle: string;
  readonly journeyHrefs: Readonly<Record<MissionStage, string>>;
  /** The section the URL asked for, or `undefined` for "wherever this starts". */
  readonly section: MissionSection | undefined;
  readonly sectionPath: (section: MissionSection) => string;
  readonly capabilities: readonly MissionCapability[];
  readonly responsePalettes: readonly ResolvedResponsePalette[];
  readonly variationPatterns: readonly VariationPattern[];
  readonly words: WordSelection;
  readonly language: string;
  readonly speak: (item: LearningItem) => void;
  readonly speakText: (text: string) => void;
  readonly translationOf: (item: LearningItem) => string | undefined;
  readonly items: readonly LearningItem[];
  readonly speakers?: readonly string[];
  /** The part the learner performs in Use, so their side is theirs in Understand. */
  readonly learnerSpeaker?: string;
  readonly onPractise: () => void;
}) {
  const [showMeanings, setShowMeanings] = useState(false);
  const [showCapabilities, setShowCapabilities] = useState(false);
  // The exchange, playable as an exchange: one line at a time, holdable, and
  // resumable from whichever turn a learner tapped.
  const conversation = useSequence(stageItems);
  const capabilitySheetId = `${id}-capabilities`;
  // The palette is most of the language on this screen, and its phrases are
  // exactly the ones a learner has not read before — so the sheet has to be
  // openable from there too, not only from the dialogue.
  const openItem = words.item ? inspectable(stageItems, stagePalettes, words.item) : undefined;

  /*
    What this stage holds, and the order it is reachable in.

    It used to be one column of everything, the wrong way up: eleven capability
    rows, up to nine response palettes and a variation lab all sat above the
    exchange, so a screen whose own text said "first understand the connected
    example" put two phone screens of English between a learner and the example.

    Turning that column the right way up fixed the first line of it and left the
    rest — the exchange, then the palettes, then the lab, in one scroll several
    screens long, with nothing at the top saying the other two were down there.
    So the three are sections now:

    - The exchange is the default, because it is what the mission is about and
      what "understand" names. Its own controls — listen, meanings, the line
      about tapping a word — belong to it and travel with it.
    - The palettes and the lab are sections rather than a sheet. They are
      *material* rather than chrome, and a mission's language is mostly in them:
      a switcher that names them and counts them still says they exist, which is
      the thing a sheet would not. It is also not available — their phrases open
      the word sheet, and a sheet cannot open a sheet.
    - The capability preview stays a sheet. It is a promise about afterwards
      rather than material, and a learner reads it once.

    The goal, the journey and Start practice sit outside the switcher: they are
    true of the stage rather than of a section of it.
  */
  const sections = [
    { id: 'dialogue' as const, label: 'Dialogue', icon: 'dialogue' as const },
    ...(stagePalettes.length
      ? [
          {
            id: 'responses' as const,
            label: 'Responses',
            icon: 'meaning' as const,
            count: stagePalettes.length,
          },
        ]
      : []),
    ...(stageVariations.length
      ? [
          {
            id: 'variations' as const,
            label: 'Variations',
            icon: 'shuffle' as const,
            count: stageVariations.length,
          },
        ]
      : []),
  ];
  // The first section it actually has, which is also what an unrecognised name
  // degrades to — a stale link should still open the mission.
  const current = sections.find((candidate) => candidate.id === section) ?? sections[0]!;

  return (
    <>
      <MissionJourney current="understand" hrefs={journeyHrefs} />
      <section className={styles.brief} aria-labelledby={`${id}-goal`}>
        <p className={styles.eyebrow}>Your goal</p>
        <h2 id={`${id}-goal`}>{missionGoal}</h2>
        {stageCapabilities.length > 0 && (
          <div className={styles.briefActions}>
            <Button
              // Named with its count, so the control says how much is behind it
              // rather than only that something is.
              aria-label={`What you’ll be able to do: ${stageCapabilities.length} ${
                stageCapabilities.length === 1 ? 'ability' : 'abilities'
              }`}
              aria-expanded={showCapabilities}
              aria-controls={capabilitySheetId}
              onClick={() => setShowCapabilities(true)}
            >
              <Icon name="study" /> What you’ll be able to do
              <span className={styles.count}>{stageCapabilities.length}</span>
            </Button>
          </div>
        )}
      </section>

      {/* One section is not a switcher. A mission with no authored palettes or
          lab has only its exchange, and a strip of one tab is furniture. */}
      {sections.length > 1 && (
        <SectionTabs
          label="Understand sections"
          current={current.id}
          tabs={sections.map((candidate) => ({
            id: candidate.id,
            label: candidate.label,
            icon: candidate.icon,
            to: sectionPath(candidate.id),
            ...('count' in candidate ? { count: candidate.count } : {}),
          }))}
        />
      )}

      {current.id === 'dialogue' && (
        <>
          <div className={styles.actions}>
            <PlaybackTransport sequence={conversation} unit="Line" playLabel="Listen to all" />
            <Button onClick={() => setShowMeanings((shown) => !shown)} aria-pressed={showMeanings}>
              {showMeanings ? 'Hide meaning' : 'Show meaning'}
            </Button>
          </div>
          <p className={styles.hint}>Tap any word for help.</p>

          {/*
            The exchange, drawn as an exchange. `learnerSpeaker` is passed so the lines
            a learner will be performing in the Use stage are already on their own side
            of the conversation here — the stages then agree about whose turn is whose
            before the learner is asked to take one.
          */}
          <Transcript
            label={`${passageTitle}, ${stageItems.length} lines`}
            lines={stageItems.map((item, index) => ({
              item,
              ...(speakers?.[index] ? { speaker: speakers[index] } : {}),
              ...(showMeanings && translationOf(item) ? { meaning: translationOf(item) } : {}),
            }))}
            {...(learnerSpeaker ? { self: learnerSpeaker } : {})}
            onSelectWord={words.open}
            selectedTokens={words.tokensFor}
            onListen={conversation.listen}
          />
        </>
      )}

      {current.id === 'responses' && (
        <ResponsePalettePanel palettes={stagePalettes} onListen={speak} words={words} />
      )}

      {current.id === 'variations' && (
        <VariationLabPanel patterns={stageVariations} language={language} onListen={speakText} />
      )}

      <Button variant="primary" block large onClick={onPractise}>
        Start practice <Icon name="forward" />
      </Button>

      {showCapabilities && (
        <Sheet
          id={capabilitySheetId}
          title="What you’ll be able to do"
          width="wide"
          onClose={() => setShowCapabilities(false)}
        >
          {/* Untitled: the sheet's own heading is already this list's name, and
              a dialog that says the same thing twice makes an agent choose. */}
          <CapabilityList capabilities={stageCapabilities} variant="preview" titled={false} />
        </Sheet>
      )}

      {openItem && (
        <WordInfoSheet
          item={openItem}
          tokenIds={words.tokens}
          onChange={words.set}
          onClose={words.close}
        />
      )}
    </>
  );
}

function responseFitsTurn(response: LearningItem, turn: LearningItem): boolean {
  if (
    turn.register &&
    response.register &&
    turn.register !== 'neutral' &&
    response.register !== 'neutral' &&
    turn.register !== response.register
  ) {
    return false;
  }
  return !(turn.address && response.address && turn.address !== response.address);
}

function UseStage({
  missionId: id,
  words,
  journeyHrefs,
  speak,
  translationOf,
  intentionCue,
  missionGoal,
  partner,
  transfer,
  transferBrief,
  transferSupport,
  transferPosition,
  transferTotal,
  capabilities: stageCapabilities,
  responsePalettes: stagePalettes,
  learnerSpeaker,
  items: stageItems,
  speakers,
  onGrade,
  onFinish,
}: {
  readonly missionId: string;
  readonly missionGoal: string;
  readonly partner: string;
  readonly transfer: boolean;
  readonly transferBrief?: string;
  readonly transferSupport: MissionTransferSupport;
  readonly transferPosition: number;
  readonly transferTotal: number;
  readonly words: WordSelection;
  readonly journeyHrefs: Readonly<Record<MissionStage, string>>;
  readonly speak: (item: LearningItem) => void;
  readonly translationOf: (item: LearningItem) => string | undefined;
  readonly intentionCue: (item: LearningItem) => string;
  readonly capabilities: readonly MissionCapability[];
  readonly responsePalettes: readonly ResolvedResponsePalette[];
  readonly learnerSpeaker?: string;
  readonly items: readonly LearningItem[];
  readonly speakers?: readonly string[];
  readonly onGrade: (
    item: LearningItem,
    grade: ReviewGrade,
    correct: boolean,
    latencyMs: number,
  ) => Promise<ReadonlyMap<SkillId, MasteryRecord>>;
  readonly onFinish: () => void;
}) {
  const language = useTargetLanguage();
  const languageName = language === undefined ? undefined : languageOption(language).englishName;
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [speechComparison, setSpeechComparison] = useState<SpeechComparison | undefined>();
  const [grades, setGrades] = useState<readonly ReviewGrade[]>([]);
  const [useCapabilities, setUseCapabilities] = useState(stageCapabilities);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const startedAt = useRef(0);
  const current = stageItems[index];
  const speaker = speakers?.[index];
  const learnerTurn = learnerSpeaker === undefined || speaker === learnerSpeaker;
  const learnerTurns = stageItems.filter((_, position) =>
    learnerSpeaker === undefined ? true : speakers?.[position] === learnerSpeaker,
  ).length;
  const activePalette = current
    ? stagePalettes.find((palette) => current.skills?.includes(palette.capability))
    : undefined;
  const acceptedResponses =
    activePalette && current
      ? [
          ...new Set([
            current.text,
            ...activePalette.responses
              .filter(({ item }) => responseFitsTurn(item, current))
              .map(({ item }) => item.text),
          ]),
        ].filter(Boolean)
      : current
        ? [current.text]
        : [];

  useEffect(() => {
    startedAt.current = Date.now();
  }, [index]);

  const advance = () => {
    setRevealed(false);
    setSpeechComparison(undefined);
    setSaveError(false);
    setIndex((currentIndex) => currentIndex + 1);
  };

  const gradeAndAdvance = async (grade: ReviewGrade, correct: boolean) => {
    if (!current || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      const mastery = await onGrade(
        current,
        grade,
        correct,
        Math.max(0, Date.now() - startedAt.current),
      );
      setUseCapabilities(
        stageCapabilities.map((capability) => {
          const evidence = mastery.get(capability.id);
          return { ...capability, ...(evidence ? { evidence } : {}) };
        }),
      );
      setGrades((recorded) => [...recorded, grade]);
      advance();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  if (!current) {
    const summary = transferGradeSummary(grades);
    return (
      <>
        <MissionJourney current="use" hrefs={journeyHrefs} />
        <section className={styles.complete} aria-labelledby={`${id}-complete`}>
          <Icon name="mastered" size="xl" />
          <p className={styles.eyebrow}>
            Transfer {transferPosition} of {transferTotal} complete
          </p>
          <h2 id={`${id}-complete`}>{missionGoal}</h2>
          <p>{summary}</p>
          <p>{transferRecommendation(grades, learnerTurns)}</p>
          {useCapabilities.length > 0 && (
            <CapabilityList capabilities={useCapabilities} variant="evidence" />
          )}
          <Button variant="primary" block large onClick={onFinish}>
            {transferPosition < transferTotal ? 'Continue mission' : 'Finish mission'}
          </Button>
        </section>
      </>
    );
  }

  return (
    <>
      <MissionJourney current="use" hrefs={journeyHrefs} />
      {transfer && (
        <section className={styles.transfer} aria-label="Transfer challenge">
          <p className={styles.eyebrow}>
            Transfer {transferPosition} of {transferTotal}
          </p>
          <p>{transferBrief ?? 'The details have changed. Use what you learned here.'}</p>
          {transferSupport === 'independent' && (
            <p>Less scripting this time: use the intention, not an English sentence.</p>
          )}
        </section>
      )}
      <div
        className={styles.roleProgress}
        role="progressbar"
        aria-label="Mission use position"
        aria-valuemin={1}
        aria-valuemax={stageItems.length}
        aria-valuenow={index + 1}
      >
        <span style={{ width: `${((index + 1) / stageItems.length) * 100}%` }} />
      </div>

      <section className={styles.roleCard} aria-labelledby={`${id}-turn`}>
        <p className={styles.eyebrow}>{learnerTurn ? 'Your turn' : `${speaker ?? partner} says`}</p>
        <h2 id={`${id}-turn`}>
          {learnerTurn ? (
            activePalette ? (
              activePalette.cue
            ) : transferSupport === 'independent' ? (
              intentionCue(current)
            ) : (
              (translationOf(current) ??
              (languageName
                ? `Respond to ${partner} in ${languageName}.`
                : `Respond to ${partner}.`))
            )
          ) : (
            // What the other person just said is exactly where an unknown word
            // stops a learner dead, and it was the one line of Spanish on this
            // screen with no way to ask about it. A span, not a paragraph: it
            // is already inside the heading.
            <TokenizedText
              as="span"
              item={current}
              onSelect={(token) => words.open(current.id, token)}
              selected={words.tokensFor(current.id)}
            />
          )}
        </h2>

        {learnerTurn ? (
          <>
            <p className={styles.coach}>
              {activePalette
                ? `${acceptedResponses.length} natural responses are accepted. Choose one that fits.`
                : 'Say the idea naturally. The exact wording comes next.'}
            </p>
            {!revealed && (
              <SpeakCheck
                key={current.id}
                expected={acceptedResponses}
                onComparison={(match) => setSpeechComparison(match.comparison)}
              />
            )}
            {revealed ? (
              <>
                <div className={styles.answer} role="status">
                  {activePalette && <small>One natural option</small>}
                  <TokenizedText
                    item={current}
                    onSelect={(token) => words.open(current.id, token)}
                    selected={words.tokensFor(current.id)}
                  />
                  <Button onClick={() => speak(current)}>
                    <Icon name="speak" /> Listen
                  </Button>
                </div>
                <p className={styles.coach}>How much could you say before revealing?</p>
                <div className={styles.turnActions}>
                  <Button disabled={saving} onClick={() => void gradeAndAdvance('again', false)}>
                    Not yet
                  </Button>
                  <Button disabled={saving} onClick={() => void gradeAndAdvance('hard', true)}>
                    Partly
                  </Button>
                  <Button
                    variant="primary"
                    disabled={saving}
                    onClick={() => void gradeAndAdvance('good', true)}
                  >
                    Got it
                  </Button>
                </div>
              </>
            ) : (
              <>
                {speechComparison && (
                  <Button
                    variant="primary"
                    block
                    large
                    disabled={saving}
                    onClick={() => {
                      const grade = gradeForSpeech(speechComparison);
                      void gradeAndAdvance(grade, grade !== 'again');
                    }}
                  >
                    Record result and continue <Icon name="forward" />
                  </Button>
                )}
                <Button block large disabled={saving} onClick={() => setRevealed(true)}>
                  Reveal the line
                </Button>
              </>
            )}
            {revealed && (
              <div className={styles.turnActions}>
                <Button
                  disabled={saving}
                  onClick={() => {
                    setRevealed(false);
                    setSpeechComparison(undefined);
                  }}
                >
                  <Icon name="again" /> Try again
                </Button>
              </div>
            )}
            {saveError && (
              <p role="alert">That attempt could not be saved. Please try the rating again.</p>
            )}
          </>
        ) : (
          <>
            {translationOf(current) && <p className={styles.meaning}>{translationOf(current)}</p>}
            <Button onClick={() => speak(current)}>
              <Icon name="speak" /> Listen
            </Button>
            <Button variant="primary" block large onClick={advance}>
              Reply <Icon name="forward" />
            </Button>
          </>
        )}
      </section>

      {words.item === current.id && (
        <WordInfoSheet
          item={current}
          tokenIds={words.tokens}
          onChange={words.set}
          onClose={words.close}
        />
      )}
    </>
  );
}

/**
 * The item a selected word belongs to, from anywhere the stage shows Spanish.
 *
 * The passage is searched first because that is where a learner reads; the
 * palettes are searched after, and they are the reason this is a function rather
 * than a `find` — a stage renders several dozen phrases across nine palettes,
 * and a word tapped in one of them has to resolve to the item that owns it or
 * the sheet opens on the wrong sentence.
 */
function inspectable(
  items: readonly LearningItem[],
  palettes: readonly ResolvedResponsePalette[],
  itemId: ItemId,
): LearningItem | undefined {
  return (
    items.find((item) => item.id === itemId) ??
    palettes.flatMap((palette) => palette.responses).find((response) => response.item.id === itemId)
      ?.item
  );
}

/**
 * `words` rather than a sheet of its own: the palette sits on the same screen as
 * the dialogue, and two independent selections would let a learner open a word
 * here and another down there and see both sheets at once. One selection per
 * stage, shared, is also what makes the sheet's own phrase navigation work
 * across everything the stage shows.
 */
function ResponsePalettePanel({
  palettes,
  onListen,
  words,
}: {
  readonly palettes: readonly ResolvedResponsePalette[];
  readonly onListen: (item: LearningItem) => void;
  readonly words: WordSelection;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  return (
    <section className={styles.palettePanel} aria-label="Natural response palettes">
      <div>
        <p className={styles.eyebrow}>Response palette</p>
        <h3>Choose what you really mean</h3>
      </div>
      {palettes.map((palette) => {
        const isExpanded = expanded.has(palette.id);
        const visible = isExpanded
          ? palette.responses
          : palette.responses.slice(0, palette.initiallyVisible);
        const hidden = palette.responses.length - visible.length;
        const listId = `response-palette-${palette.id}`;
        return (
          <div key={palette.id} className={styles.paletteGroup}>
            <h4>{palette.title}</h4>
            <p>{palette.cue}</p>
            <ul id={listId} className={styles.paletteResponses}>
              {visible.map(({ item, meaning, nuance }) => (
                <li key={item.id}>
                  <div>
                    {/* Named by palette *and* phrase, not by phrase alone: a
                        palette deliberately offers the line the dialogue below
                        also shows, so two controls would otherwise be called
                        `About “Soy” in “Soy de Grecia…”` on one screen. */}
                    <TokenizedText
                      item={item}
                      className={styles.paletteText}
                      onSelect={(token) => words.open(item.id, token)}
                      selected={words.tokensFor(item.id)}
                      contextLabel={`${palette.title} · ${item.text}`}
                    />
                    {meaning && <span>{meaning}</span>}
                    <small>{nuance}</small>
                  </div>
                  <Button
                    onClick={() => onListen(item)}
                    aria-label={`Listen to response “${item.text}”`}
                  >
                    <Icon name="speak" />
                  </Button>
                </li>
              ))}
            </ul>
            {hidden > 0 && (
              <Button
                // Named by palette: a stage shows up to eleven of these, and
                // `Show 5 more natural responses` said eleven times over is a
                // control neither a screen reader nor an agent can pick.
                aria-label={`${palette.title}: show ${hidden} more responses`}
                aria-expanded={isExpanded}
                aria-controls={listId}
                onClick={() =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (isExpanded) next.delete(palette.id);
                    else next.add(palette.id);
                    return next;
                  })
                }
              >
                Show {hidden} more natural responses
              </Button>
            )}
            {isExpanded && palette.responses.length > palette.initiallyVisible && (
              <Button
                aria-label={`${palette.title}: show fewer responses`}
                aria-expanded={true}
                aria-controls={listId}
                onClick={() =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    next.delete(palette.id);
                    return next;
                  })
                }
              >
                Show fewer responses
              </Button>
            )}
          </div>
        );
      })}
    </section>
  );
}

function VariationLabPanel({
  patterns,
  language,
  onListen,
}: {
  readonly patterns: readonly VariationPattern[];
  readonly language: string;
  readonly onListen: (text: string) => void;
}) {
  return (
    <section className={styles.variationPanel} aria-label="Variation lab">
      <div>
        <p className={styles.eyebrow}>Variation lab</p>
        <h3>Keep the pattern. Change the message.</h3>
      </div>
      {patterns.map((pattern) => (
        <VariationBuilder
          key={pattern.id}
          pattern={pattern}
          language={language}
          onListen={onListen}
        />
      ))}
    </section>
  );
}

function VariationBuilder({
  pattern,
  language,
  onListen,
}: {
  readonly pattern: VariationPattern;
  readonly language: string;
  readonly onListen: (text: string) => void;
}) {
  const ids = useId();
  const languageName = languageOption(language).englishName;
  const [selections, setSelections] = useState<Readonly<Record<string, string>>>(() =>
    defaultVariationSelections(pattern),
  );
  const [hidden, setHidden] = useState(false);
  const variation = renderVariation(pattern, selections);

  return (
    <div className={styles.variationBuilder}>
      <div>
        <h4>{pattern.title}</h4>
        <p>{pattern.cue}</p>
      </div>

      <div className={styles.variationChoices}>
        {pattern.slots.map((slot) => {
          const id = `${ids}-${slot.id}`;
          return (
            <div key={slot.id} className={styles.variationField}>
              <label htmlFor={id}>{slot.label}</label>
              <select
                id={id}
                value={selections[slot.id]}
                onChange={(event) =>
                  setSelections((current) => ({
                    ...current,
                    [slot.id]: event.target.value,
                  }))
                }
              >
                {slot.choices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.target}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div className={styles.variationResult}>
        <span>{variation.reference}</span>
        {hidden ? (
          <strong role="status">{languageName} hidden — say it from the meaning.</strong>
        ) : (
          <strong role="status" lang={language}>
            {variation.target}
          </strong>
        )}
      </div>

      <div className={styles.variationActions}>
        <Button onClick={() => onListen(variation.target)}>
          <Icon name="speak" /> Listen
        </Button>
        <Button aria-pressed={hidden} onClick={() => setHidden((current) => !current)}>
          {hidden ? `Show ${languageName}` : 'Practise from meaning'}
        </Button>
      </div>

      {hidden && <SpeakCheck key={variation.target} expected={variation.target} />}
    </div>
  );
}

function CapabilityList({
  capabilities,
  variant,
  titled = true,
}: {
  readonly capabilities: readonly MissionCapability[];
  readonly variant: 'preview' | 'evidence';
  /** Off where the container already names the list — inside its own sheet. */
  readonly titled?: boolean;
}) {
  return (
    <section className={styles.capabilityPanel} aria-label="Mission capabilities">
      {titled && (
        <h3>{variant === 'preview' ? 'What you’ll be able to do' : 'Capability evidence'}</h3>
      )}
      <ul className={styles.capabilities}>
        {capabilities.map((capability) => (
          <li key={capability.id}>
            <Icon name={capabilityEvidenceIcon(capability.evidence)} size="sm" />
            <span>{capability.label}</span>
            {variant === 'evidence' && (
              <strong>{capabilityEvidenceLabel(capability.evidence)}</strong>
            )}
          </li>
        ))}
      </ul>
      {variant === 'evidence' && (
        <p>
          Based on retrieval during practice. Strength grows when you handle the same ability in new
          situations.
        </p>
      )}
    </section>
  );
}

function capabilityEvidenceLabel(evidence: MasteryRecord | undefined): string {
  if (!evidence) return 'Not tested';
  if (evidence.status === 'strong') return 'Reliable';
  if (evidence.status === 'developing') return 'Developing';
  return 'Needs work';
}

function capabilityEvidenceIcon(
  evidence: MasteryRecord | undefined,
): 'again' | 'check' | 'forward' {
  if (evidence?.status === 'strong') return 'check';
  return evidence?.status === 'weak' ? 'again' : 'forward';
}

function gradeForSpeech(comparison: SpeechComparison): ReviewGrade {
  if (comparison.verdict === 'match') return 'good';
  return comparison.verdict === 'close' ? 'hard' : 'again';
}

function transferGradeSummary(grades: readonly ReviewGrade[]): string {
  const solid = grades.filter((grade) => grade === 'good' || grade === 'easy').length;
  const partial = grades.filter((grade) => grade === 'hard').length;
  const notYet = grades.filter((grade) => grade === 'again').length;
  return `${grades.length} transfer ${grades.length === 1 ? 'attempt' : 'attempts'} recorded: ${solid} solid, ${partial} partial, ${notYet} not yet.`;
}

function transferRecommendation(grades: readonly ReviewGrade[], learnerTurns: number): string {
  if (grades.some((grade) => grade === 'again')) {
    return 'Next: review the lines marked “Not yet”, then try this transfer again.';
  }
  if (grades.some((grade) => grade === 'hard')) {
    return 'Next: repeat this transfer once more before moving to a new situation.';
  }
  return `You recalled all ${learnerTurns} ${learnerTurns === 1 ? 'line' : 'lines'}. Next: use these abilities in another context.`;
}
