/**
 * Drives one practice session: plan → generate → grade → persist → advance.
 *
 * All the thinking lives in the domain layer; this hook only sequences it and
 * holds the React state the screens render.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useServices } from '../../app/services-context';
import type { ItemId, LearningItem } from '../../domain/content';
import {
  gradeExercise,
  type Answer,
  type Exercise,
  type GradeResult,
} from '../../domain/exercises';
import { recordAttempt, type ItemProgress, type ReviewGrade } from '../../domain/progress';
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

export interface SessionRunner {
  readonly status: SessionStatus;
  readonly exercise: Exercise | null;
  readonly item: LearningItem | null;
  readonly index: number;
  readonly total: number;
  readonly stats: SessionStats;
  readonly lastResult: GradeResult | null;
  /** Machine-graded exercises: returns the verdict and records it. */
  submitAnswer(answer: Answer): GradeResult | null;
  /** Self-rated exercises (spec §4.2). */
  submitGrade(grade: ReviewGrade, latencyMs?: number): void;
  next(): void;
  previous(): void;
  restart(): void;
}

export function useSessionRunner(config: SessionConfig): SessionRunner {
  const { services } = useServices();
  const { repository, storage, exercises } = services;

  const [status, setStatus] = useState<SessionStatus>('loading');
  const [steps, setSteps] = useState<readonly SessionStep[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState<SessionStats>({ answered: 0, correct: 0 });
  const [lastResult, setLastResult] = useState<GradeResult | null>(null);
  const [generation, setGeneration] = useState(0);

  const progressRef = useRef(new Map<ItemId, ItemProgress>());
  const startedAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setStatus('loading');
      const stored = await storage.progress.all();
      if (cancelled) return;

      const progress = new Map(stored.map((entry) => [entry.itemId, entry]));
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

      startedAtRef.current = Date.now();
      setSessionId(plan.id);
      setSteps(composed);
      setIndex(0);
      setStats({ answered: 0, correct: 0 });
      setLastResult(null);
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
        return current;
      }
      return next;
    });
  }, [steps.length]);

  const persist = useCallback(
    (grade: ReviewGrade, correct: boolean | undefined, latencyMs: number | undefined) => {
      if (!exercise || !item) return;
      const now = Date.now();
      const { progress, attempt } = recordAttempt(
        progressRef.current.get(item.id),
        {
          itemId: item.id,
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
      setStats((current) => ({
        answered: current.answered + 1,
        correct: current.correct + (grade === 'again' ? 0 : 1),
      }));
    },
    [exercise, item, sessionId, storage],
  );

  // Session totals are written once the last item is graded.
  useEffect(() => {
    if (status !== 'complete') return;
    void storage.sessions.put({
      id: sessionId,
      startedAt: startedAtRef.current,
      endedAt: Date.now(),
      planned: steps.length,
      completed: stats.answered,
      correct: stats.correct,
    });
  }, [status, sessionId, steps.length, stats, storage]);

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

  const restart = useCallback(() => setGeneration((value) => value + 1), []);

  return {
    status,
    exercise,
    item,
    index,
    total: steps.length,
    stats,
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
