/**
 * Drives one practice session: plan → generate → grade → persist → advance.
 *
 * All the thinking lives in the domain layer; this hook only sequences it and
 * holds the React state the screens render.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useServices } from '../../app/services-context';
import { isItemId, type Course, type ItemId, type LearningItem } from '../../domain/content';
import {
  gradeExercise,
  type Answer,
  type Exercise,
  type GradeResult,
} from '../../domain/exercises';
import {
  recordAttempt,
  type SubjectProgress,
  type ItemStatus,
  type ReviewGrade,
} from '../../domain/progress';
import {
  composeSession,
  planSession,
  type SessionConfig,
  type SessionStep,
} from '../../domain/sessions';
import { seededRng } from '../../utils/random';

export type SessionStatus = 'loading' | 'active' | 'complete' | 'empty';

export interface SessionStats {
  readonly answered: number;
  readonly correct: number;
}

/** One item whose scheduling stage changed during the session. */
export interface StageChange {
  readonly itemId: ItemId;
  readonly text: string;
  readonly from: ItemStatus;
  readonly to: ItemStatus;
}

/**
 * What the session actually achieved, as opposed to how many questions went by.
 *
 * A fraction tells a learner nothing they can act on. Which words moved up a
 * stage, and which slipped back, is the thing worth being told — and it is all
 * derived from progress the session was already writing, so reporting it costs
 * one snapshot per answer and no new storage.
 *
 * Empty in study mode, because nothing is recorded there and a summary implying
 * otherwise would contradict the sentence printed beneath it.
 */
export interface SessionOutcome {
  readonly advanced: readonly StageChange[];
  readonly lapsed: readonly StageChange[];
  /**
   * Whole days until the soonest of these items comes back.
   *
   * Days, resolved when the answer landed, rather than a timestamp the screen
   * turns into "tomorrow" at render time — reading a clock during render is
   * impure, and the difference between the two is imperceptible on a results
   * screen. Coarse on purpose: an interval stated to the hour invites treating
   * the schedule as a deadline, which is the opposite of how spacing works.
   */
  readonly nextDueInDays?: number;
}

const STAGE_ORDER: readonly ItemStatus[] = ['new', 'learning', 'review', 'mastered'];

/** Positive when the second stage is further along than the first. */
function stageDelta(from: ItemStatus, to: ItemStatus): number {
  return STAGE_ORDER.indexOf(to) - STAGE_ORDER.indexOf(from);
}

export interface SessionRunner {
  readonly status: SessionStatus;
  /** Epoch ms the session became active; 0 while it is still being planned. */
  readonly startedAt: number;
  /** How long it took, once finished. Null while it is still running. */
  readonly durationMs: number | null;
  readonly exercise: Exercise | null;
  readonly item: LearningItem | null;
  readonly index: number;
  readonly total: number;
  readonly stats: SessionStats;
  readonly outcome: SessionOutcome;
  /** False in study mode: nothing is written and no score is reported. */
  readonly tracked: boolean;
  readonly lastResult: GradeResult | null;
  /** Machine-graded exercises: returns the verdict and records it. */
  submitAnswer(answer: Answer): GradeResult | null;
  /** Self-rated exercises (spec §4.2). */
  submitGrade(grade: ReviewGrade, latencyMs?: number): void;
  next(): void;
  previous(): void;
  restart(): void;
}

/**
 * `course` is here only because the session *record* needs it. The config
 * already says which packs and levels to plan from, but a finished session is
 * counts and timestamps: nothing in the row can say afterwards which language it
 * was, and the screen is the last place that knows.
 */
export function useSessionRunner(config: SessionConfig, course: Course): SessionRunner {
  const { services } = useServices();
  const { repository, storage, exercises } = services;

  const [status, setStatus] = useState<SessionStatus>('loading');
  const [steps, setSteps] = useState<readonly SessionStep[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState<SessionStats>({ answered: 0, correct: 0 });
  const [lastResult, setLastResult] = useState<GradeResult | null>(null);
  const [changes, setChanges] = useState<readonly StageChange[]>([]);
  const [nextDueInDays, setNextDueInDays] = useState<number | undefined>(undefined);
  const [generation, setGeneration] = useState(0);
  // State rather than a ref: the timer renders from it, and reading a ref
  // during render is what the React Compiler rules forbid.
  const [startedAt, setStartedAt] = useState(0);
  /**
   * How long the session took, frozen when it ended.
   *
   * Kept for every session, not only tracked ones: a study session is not
   * scored, but the time it took is still a fact about it, and the summary says
   * so rather than pretending the clock stopped existing.
   */
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const tracked = config.mode !== 'study';

  const progressRef = useRef(new Map<ItemId, SubjectProgress>());

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setStatus('loading');
      const stored = await storage.progress.all();
      if (cancelled) return;

      // A session plans over items, so the rows a drill writes against a pattern
      // are not part of one and are dropped rather than carried and never read.
      const progress = new Map<ItemId, SubjectProgress>();
      for (const entry of stored) {
        if (isItemId(entry.subject)) progress.set(entry.subject, entry);
      }
      progressRef.current = progress;

      const plan = planSession({ repository, config, progress, now: Date.now() });
      if (cancelled) return;

      // The planner picks what to practise; the composer picks how, moving each
      // item along the recognition → recall → production ladder and keeping the
      // session from settling into a single exercise type.
      const composed = composeSession({
        items: plan.itemIds
          .map((id) => repository.getItem(id))
          .filter((item) => item !== undefined),
        progress,
        allowed: config.exerciseKinds,
        rng: seededRng(hash(plan.id)),
        study: config.mode === 'study',
      });

      setStartedAt(Date.now());
      setDurationMs(null);
      setSessionId(plan.id);
      setSteps(composed);
      setIndex(0);
      setStats({ answered: 0, correct: 0 });
      setLastResult(null);
      setChanges([]);
      setNextDueInDays(undefined);
      setStatus(composed.length === 0 ? 'empty' : 'active');
    })();

    return () => {
      cancelled = true;
    };
  }, [repository, storage, config, generation]);

  const step = steps[index] ?? null;

  const item = useMemo(() => {
    const id = step?.itemId;
    return id ? (repository.getItem(id) ?? null) : null;
  }, [step, repository]);

  const exercise = useMemo(() => {
    if (!item) return null;
    return exercises.generateFirst(item, step?.kinds ?? config.exerciseKinds, {
      repository,
      referenceLanguage: config.referenceLanguage,
      // Seeded per position so re-renders never reshuffle the choices.
      rng: seededRng(hash(`${sessionId}:${item.id}:${index}`)),
    });
  }, [
    item,
    step,
    exercises,
    config.exerciseKinds,
    config.referenceLanguage,
    repository,
    sessionId,
    index,
  ]);

  const advance = useCallback(() => {
    setLastResult(null);
    setIndex((current) => {
      const next = current + 1;
      if (next >= steps.length) {
        setStatus('complete');
        // Stopped here rather than in an effect watching `status`: advancing is
        // the event that ends the session, an event handler may read the clock,
        // and the React Compiler rules forbid setting state from an effect.
        if (startedAt > 0) setDurationMs(Date.now() - startedAt);
        return current;
      }
      return next;
    });
  }, [steps.length, startedAt]);

  const persist = useCallback(
    (grade: ReviewGrade, correct: boolean | undefined, latencyMs: number | undefined) => {
      if (!exercise || !item) return;

      // A study session browses rather than tests, so it records nothing: a
      // self-rated reveal is not evidence of retrieval, and Browse routes into
      // one — flipping through cards must not reschedule what it showed.
      if (tracked) {
        const now = Date.now();
        const before = progressRef.current.get(item.id)?.status ?? 'new';
        const { progress, attempt } = recordAttempt(
          progressRef.current.get(item.id),
          {
            subject: item.id,
            exerciseKind: exercise.kind,
            grade,
            sessionId,
            ...(correct !== undefined ? { correct } : {}),
            ...(latencyMs !== undefined ? { latencyMs } : {}),
          },
          now,
        );
        progressRef.current.set(item.id, progress);
        void storage.progress.put(progress);
        void storage.attempts.append(attempt);

        // One entry per item, keeping the *net* move across a session that saw
        // the same item twice: reporting a word as both advanced and lapsed
        // would be two true statements adding up to a false impression.
        // Soonest return among the items actually answered — a skipped item keeps
        // whatever schedule it already had, so counting it would be a promise
        // this session did not make.
        if (progress.dueAt !== undefined) {
          const days = Math.round((progress.dueAt - now) / 86_400_000);
          setNextDueInDays((current) => (current === undefined ? days : Math.min(current, days)));
        }

        const delta = stageDelta(before, progress.status);
        if (delta !== 0) {
          setChanges((current) => {
            const others = current.filter((change) => change.itemId !== item.id);
            const from = current.find((change) => change.itemId === item.id)?.from ?? before;
            if (stageDelta(from, progress.status) === 0) return others;
            return [...others, { itemId: item.id, text: item.text, from, to: progress.status }];
          });
        }
      }

      // Counted either way; the screen presents it as a score only when tracked.
      setStats((current) => ({
        answered: current.answered + 1,
        correct: current.correct + (grade === 'again' ? 0 : 1),
      }));
    },
    [exercise, item, sessionId, storage, tracked],
  );

  // Session totals are written once the last item is graded.
  useEffect(() => {
    if (status !== 'complete' || !tracked) return;
    void storage.sessions.put({
      id: sessionId,
      course,
      startedAt,
      endedAt: Date.now(),
      planned: steps.length,
      completed: stats.answered,
      correct: stats.correct,
    });
  }, [status, tracked, sessionId, course, startedAt, steps.length, stats, storage]);

  const submitAnswer = useCallback(
    (answer: Answer): GradeResult | null => {
      if (!exercise) return null;
      const result = gradeExercise(exercise, answer);
      if (!result) return null;
      setLastResult(result);
      persist(result.grade, result.correct, answer.latencyMs);
      return result;
    },
    [exercise, persist],
  );

  const submitGrade = useCallback(
    (grade: ReviewGrade, latencyMs?: number) => {
      persist(grade, undefined, latencyMs);
      advance();
    },
    [persist, advance],
  );

  const previous = useCallback(() => {
    setLastResult(null);
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  /**
   * Derived, never stored, like everything else about progress. Both halves are
   * accumulated as answers land rather than read back from the progress ref: a
   * ref read during render is what the React Compiler rules forbid, and the
   * scheduler's own numbers are the ones worth reporting.
   */
  const outcome = useMemo<SessionOutcome>(
    () => ({
      advanced: changes.filter((change) => stageDelta(change.from, change.to) > 0),
      lapsed: changes.filter((change) => stageDelta(change.from, change.to) < 0),
      ...(nextDueInDays !== undefined ? { nextDueInDays } : {}),
    }),
    [changes, nextDueInDays],
  );

  const restart = useCallback(() => setGeneration((value) => value + 1), []);

  return {
    status,
    startedAt,
    durationMs,
    exercise,
    item,
    index,
    total: steps.length,
    stats,
    outcome,
    tracked,
    lastResult,
    submitAnswer,
    submitGrade,
    next: advance,
    previous,
    restart,
  };
}

/** Stable 32-bit string hash, used to seed per-item randomness. */
function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
