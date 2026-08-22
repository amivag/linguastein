import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MISSIONS } from '../../app/missions';
import { useCourse } from '../../app/course';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { TokenizedText } from '../../components/TokenizedText';
import { useWordSelection } from '../../components/useWordSelection';
import { WordInfoSheet } from '../../components/WordInfoSheet';
import { missionById, missionPassageForStage, type MissionStage } from '../../domain/missions';
import type { LearningItem, SkillId } from '../../domain/content';
import type { SpeechComparison } from '../../domain/exercises';
import {
  inferMastery,
  recordAttempt,
  type MasteryRecord,
  type ReviewGrade,
} from '../../domain/progress';
import { SpeakCheck } from '../practice/SpeakCheck';
import { MissionJourney } from './MissionJourney';
import { missionPracticePath } from './mission-url';
import styles from './Mission.module.css';

interface MissionCapability {
  readonly id: SkillId;
  readonly label: string;
  readonly evidence?: MasteryRecord;
}

/** The reusable Understand → Practise → Use journey over one connected passage. */
export function MissionScreen() {
  const { missionId = '', stage = 'understand' } = useParams();
  const navigate = useNavigate();
  const { course, filter, path } = useCourse();
  const { services, preferences } = useServices();
  const mission = missionById(MISSIONS, course, missionId);
  const chosenStage: MissionStage = stage === 'use' ? 'use' : 'understand';
  const passageLocalId = mission ? missionPassageForStage(mission, chosenStage) : undefined;
  const requestedPassage = passageLocalId
    ? services.repository.passageByLocalId(passageLocalId)
    : undefined;
  // A curriculum may run against a compatible pack version that predates its
  // optional transfer passage. Widen to the taught exchange instead of making
  // the whole mission unavailable.
  const passage =
    requestedPassage ??
    (mission ? services.repository.passageByLocalId(mission.passage) : undefined);
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
        const skill = services.repository.skillByLocalId(slug);
        if (!skill || skill.kind !== 'function') return [];
        const label =
          services.repository.translationOf(skill.id, preferences.referenceLanguage)?.text ??
          skill.label;
        const evidence = skillMastery.get(skill.id);
        return [{ id: skill.id, label, ...(evidence ? { evidence } : {}) }];
      }),
    [mission, preferences.referenceLanguage, services.repository, skillMastery],
  );

  const recordMissionUse = useCallback(
    async (item: LearningItem, grade: ReviewGrade, correct: boolean, latencyMs: number) => {
      if (!mission) return new Map<SkillId, MasteryRecord>();
      const now = Date.now();
      const sessionId =
        missionUseSession.current ?? `mission:${mission.id}:use:${now.toString(36)}`;
      missionUseSession.current = sessionId;
      const current = await services.storage.progress.get(item.id);
      const recorded = recordAttempt(
        current,
        {
          itemId: item.id,
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
    [mission, services],
  );

  if (!mission || !passage || !available) {
    return (
      <AppShell title="Mission" onBack="history" showNav={false}>
        <section className={styles.empty}>
          <Icon name="passage" size="xl" />
          <p>This mission is not available in the current course.</p>
          <Button variant="primary" block onClick={() => void navigate(path())}>
            Back to missions
          </Button>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell title={mission.title} onBack="history" showNav={false}>
      {chosenStage === 'understand' ? (
        <UnderstandStage
          missionId={mission.id}
          missionGoal={mission.goal}
          passageTitle={passage.title}
          capabilities={capabilities}
          items={items}
          {...(passage.speakers ? { speakers: passage.speakers } : {})}
          onPractise={() => void navigate(missionPracticePath(course, mission))}
        />
      ) : (
        <UseStage
          missionId={mission.id}
          missionGoal={mission.goal}
          partner={mission.scenarioPartner}
          transfer={isTransfer}
          capabilities={capabilities}
          {...(mission.learnerSpeaker ? { learnerSpeaker: mission.learnerSpeaker } : {})}
          items={items}
          {...(passage.speakers ? { speakers: passage.speakers } : {})}
          onGrade={recordMissionUse}
          onFinish={() => void navigate(path())}
        />
      )}
    </AppShell>
  );

  function translationOf(item: LearningItem): string | undefined {
    return services.repository.translationOf(item.id, preferences.referenceLanguage)?.text;
  }

  function speak(item: LearningItem) {
    void services.audio.speak({
      text: item.text,
      locale: preferences.pronunciationLocale,
      ...(preferences.voiceName ? { voice: preferences.voiceName } : {}),
    });
  }

  function UnderstandStage({
    missionId: id,
    missionGoal,
    passageTitle,
    capabilities: stageCapabilities,
    items: stageItems,
    speakers,
    onPractise,
  }: {
    readonly missionId: string;
    readonly missionGoal: string;
    readonly passageTitle: string;
    readonly capabilities: readonly MissionCapability[];
    readonly items: readonly LearningItem[];
    readonly speakers?: readonly string[];
    readonly onPractise: () => void;
  }) {
    const [showMeanings, setShowMeanings] = useState(false);
    const words = useWordSelection();
    const openItem = words.item ? stageItems.find((item) => item.id === words.item) : undefined;

    return (
      <>
        <MissionJourney current="understand" />
        <section className={styles.brief} aria-labelledby={`${id}-goal`}>
          <p className={styles.eyebrow}>Your goal</p>
          <h2 id={`${id}-goal`}>{missionGoal}</h2>
          <p>First understand the connected example. Tap any word when you need help.</p>
        </section>

        {stageCapabilities.length > 0 && (
          <CapabilityList capabilities={stageCapabilities} variant="preview" />
        )}

        <div className={styles.actions}>
          <Button onClick={() => void speakAll(stageItems)}>
            <Icon name="speak" /> Listen to all
          </Button>
          <Button onClick={() => setShowMeanings((shown) => !shown)} aria-pressed={showMeanings}>
            {showMeanings ? 'Hide meaning' : 'Show meaning'}
          </Button>
        </div>

        <ol className={styles.lines} aria-label={`${passageTitle}, ${stageItems.length} lines`}>
          {stageItems.map((item, index) => (
            <li key={item.id}>
              {speakers?.[index] && <p className={styles.speaker}>{speakers[index]}</p>}
              <TokenizedText
                item={item}
                className={styles.lineText}
                onSelect={(token) => words.open(item.id, token)}
                selected={words.tokensFor(item.id)}
                contextLabel={item.text}
              />
              {showMeanings && translationOf(item) && (
                <p className={styles.meaning}>{translationOf(item)}</p>
              )}
              <button
                type="button"
                className={styles.linePlay}
                onClick={() => speak(item)}
                aria-label={`Listen to “${item.text}”`}
              >
                <Icon name="speak" size="lg" />
              </button>
            </li>
          ))}
        </ol>

        <Button variant="primary" block large onClick={onPractise}>
          Start practice <Icon name="forward" />
        </Button>

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

  function UseStage({
    missionId: id,
    missionGoal,
    partner,
    transfer,
    capabilities: stageCapabilities,
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
    readonly capabilities: readonly MissionCapability[];
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
          <MissionJourney current="use" />
          <section className={styles.complete} aria-labelledby={`${id}-complete`}>
            <Icon name="mastered" size="xl" />
            <p className={styles.eyebrow}>Transfer complete</p>
            <h2 id={`${id}-complete`}>{missionGoal}</h2>
            <p>{summary}</p>
            <p>{transferRecommendation(grades, learnerTurns)}</p>
            {useCapabilities.length > 0 && (
              <CapabilityList capabilities={useCapabilities} variant="evidence" />
            )}
            <Button variant="primary" block large onClick={onFinish}>
              Finish mission
            </Button>
          </section>
        </>
      );
    }

    return (
      <>
        <MissionJourney current="use" />
        {transfer && (
          <section className={styles.transfer} aria-label="Transfer challenge">
            <p className={styles.eyebrow}>Transfer challenge</p>
            <p>Same real-world goal, but the details have changed. Use what you learned here.</p>
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
          <p className={styles.eyebrow}>
            {learnerTurn ? 'Your turn' : `${speaker ?? partner} says`}
          </p>
          <h2 id={`${id}-turn`}>
            {learnerTurn
              ? (translationOf(current) ?? `Respond to ${partner} in Spanish.`)
              : current.text}
          </h2>

          {learnerTurn ? (
            <>
              <p className={styles.coach}>Say the idea naturally. The exact wording comes next.</p>
              {!revealed && (
                <SpeakCheck
                  key={current.id}
                  expected={current.text}
                  onComparison={setSpeechComparison}
                />
              )}
              {revealed ? (
                <>
                  <div className={styles.answer} role="status">
                    <p lang={course.language}>{current.text}</p>
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
      </>
    );
  }

  function speakAll(stageItems: readonly LearningItem[]) {
    void services.audio.speak({
      text: stageItems.map((item) => item.text).join(' '),
      locale: preferences.pronunciationLocale,
      ...(preferences.voiceName ? { voice: preferences.voiceName } : {}),
    });
  }
}

function CapabilityList({
  capabilities,
  variant,
}: {
  readonly capabilities: readonly MissionCapability[];
  readonly variant: 'preview' | 'evidence';
}) {
  return (
    <section className={styles.capabilityPanel} aria-label="Mission capabilities">
      <h3>{variant === 'preview' ? 'What you’ll be able to do' : 'Capability evidence'}</h3>
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
