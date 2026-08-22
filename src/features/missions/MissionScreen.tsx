import { useEffect, useMemo, useState } from 'react';
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
import { inferMastery, type MasteryRecord } from '../../domain/progress';
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

  useEffect(() => {
    if (!mission?.capabilities?.length) return;
    let cancelled = false;
    void services.storage.progress.all().then((progress) => {
      if (!cancelled) setSkillMastery(inferMastery(services.repository, progress).skills);
    });
    return () => {
      cancelled = true;
    };
  }, [mission, services]);

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
          <p>First understand the whole exchange. Tap any word when you need help.</p>
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
    readonly onFinish: () => void;
  }) {
    const [index, setIndex] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const current = stageItems[index];
    const speaker = speakers?.[index];
    const learnerTurn = learnerSpeaker === undefined || speaker === learnerSpeaker;
    const learnerTurns = stageItems.filter((_, position) =>
      learnerSpeaker === undefined ? true : speakers?.[position] === learnerSpeaker,
    ).length;

    const advance = () => {
      setRevealed(false);
      setIndex((currentIndex) => currentIndex + 1);
    };

    if (!current) {
      return (
        <>
          <MissionJourney current="use" />
          <section className={styles.complete} aria-labelledby={`${id}-complete`}>
            <Icon name="mastered" size="xl" />
            <p className={styles.eyebrow}>Mission complete</p>
            <h2 id={`${id}-complete`}>{missionGoal}</h2>
            <p>
              You produced {learnerTurns} useful {learnerTurns === 1 ? 'line' : 'lines'} in a
              connected situation. Practised phrases are already scheduled for review.
            </p>
            {stageCapabilities.length > 0 && (
              <CapabilityList capabilities={stageCapabilities} variant="evidence" />
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
            <p>Same real-world goal, but the details have changed. Respond to this new exchange.</p>
          </section>
        )}
        <div
          className={styles.roleProgress}
          role="progressbar"
          aria-label="Role-play position"
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
              {!revealed && <SpeakCheck expected={current.text} />}
              {revealed ? (
                <div className={styles.answer} role="status">
                  <p lang={course.language}>{current.text}</p>
                  <Button onClick={() => speak(current)}>
                    <Icon name="speak" /> Listen
                  </Button>
                </div>
              ) : (
                <Button block large onClick={() => setRevealed(true)}>
                  Reveal the line
                </Button>
              )}
              {revealed && (
                <div className={styles.turnActions}>
                  <Button onClick={() => setRevealed(false)}>
                    <Icon name="again" /> Try again
                  </Button>
                  <Button variant="primary" onClick={advance}>
                    Continue <Icon name="forward" />
                  </Button>
                </div>
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
            <Icon name={capability.evidence ? 'check' : 'forward'} size="sm" />
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
  return 'First evidence';
}
