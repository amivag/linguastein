/**
 * Named practice presets — the small, useful subset of session options the
 * first UI exposes (spec §5). Everything here is just a `SessionConfig`
 * factory; the planner and the engine know nothing about presets.
 */

import type { ContentRepository, ItemFilter, LexemeId } from '../../domain/content';
import type { ExerciseKind } from '../../domain/exercises';
import type { Ordering, SessionConfig, SessionSize } from '../../domain/sessions';
import type { Preferences } from '../../storage';

export const PRESET_IDS = [
  'quick',
  'listen',
  'speaking',
  'flashcards',
  'verbs',
  'vocabulary',
] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export interface Preset {
  readonly id: PresetId;
  readonly label: string;
  readonly description: string;
  readonly exerciseKinds: readonly ExerciseKind[];
  readonly mode: SessionConfig['mode'];
  readonly ordering: Ordering;
  filter(repository: ContentRepository): ItemFilter;
}

export const PRESETS: Record<PresetId, Preset> = {
  quick: {
    id: 'quick',
    label: 'Quick practice',
    description: 'Listen, repeat and recall — mixed',
    // Preference order: the first kind an item supports wins.
    exerciseKinds: ['multiple-choice', 'think-say', 'listen-repeat'],
    mode: 'practice',
    ordering: 'smart',
    filter: () => ({}),
  },
  listen: {
    id: 'listen',
    label: 'Listen & repeat',
    description: 'Hear it, say it back, check yourself',
    exerciseKinds: ['listen-repeat'],
    mode: 'practice',
    ordering: 'smart',
    filter: () => ({ types: ['sentence', 'phrase'] }),
  },
  speaking: {
    id: 'speaking',
    label: 'Think & say',
    description: 'Say the Spanish before you reveal it',
    exerciseKinds: ['think-say'],
    mode: 'practice',
    ordering: 'smart',
    filter: () => ({ types: ['sentence', 'phrase'] }),
  },
  flashcards: {
    id: 'flashcards',
    label: 'Flashcards',
    description: 'See it, say it, reveal the meaning',
    exerciseKinds: ['reveal'],
    mode: 'study',
    ordering: 'sequential',
    filter: () => ({}),
  },
  verbs: {
    id: 'verbs',
    label: 'Verbs',
    description: 'Useful forms inside natural sentences',
    exerciseKinds: ['cloze-choice', 'think-say', 'listen-repeat'],
    mode: 'practice',
    ordering: 'smart',
    filter: (repository) => ({ lexemes: verbLexemes(repository) }),
  },
  vocabulary: {
    id: 'vocabulary',
    label: 'Vocabulary',
    description: 'Words, with examples in context',
    exerciseKinds: ['multiple-choice', 'reveal', 'listen-repeat'],
    mode: 'practice',
    ordering: 'smart',
    filter: () => ({ types: ['word'] }),
  },
};

export function isPresetId(value: string | null): value is PresetId {
  return value !== null && (PRESET_IDS as readonly string[]).includes(value);
}

export interface BuildConfigOptions {
  readonly repository: ContentRepository;
  readonly preferences: Preferences;
  readonly size: SessionSize;
  readonly ordering?: Ordering;
  readonly seed?: number;
}

export function buildSessionConfig(preset: Preset, options: BuildConfigOptions): SessionConfig {
  return {
    mode: preset.mode,
    filter: preset.filter(options.repository),
    size: options.size,
    ordering: options.ordering ?? preset.ordering,
    exerciseKinds: preset.exerciseKinds,
    referenceLanguage: options.preferences.referenceLanguage,
    pronunciationLocale: options.preferences.pronunciationLocale,
    maxNewItems: 8,
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
  };
}

/** Serialises a session size for the URL, e.g. `items:10` or `time:5`. */
export function formatSize(size: SessionSize): string {
  switch (size.kind) {
    case 'items':
      return `items:${size.count}`;
    case 'time':
      return `time:${size.minutes}`;
    case 'all':
      return 'all';
  }
}

export function parseSize(value: string | null): SessionSize {
  const [kind, amount] = (value ?? '').split(':');
  const parsed = Number(amount);
  if (kind === 'items' && Number.isFinite(parsed)) return { kind: 'items', count: parsed };
  if (kind === 'time' && Number.isFinite(parsed)) return { kind: 'time', minutes: parsed };
  if (kind === 'all') return { kind: 'all' };
  return { kind: 'items', count: 10 };
}

function verbLexemes(repository: ContentRepository): readonly LexemeId[] {
  const ids = new Set<LexemeId>();
  for (const item of repository.query()) {
    for (const lexemeId of item.lexemes ?? []) {
      if (repository.getLexeme(lexemeId)?.pos === 'VERB') ids.add(lexemeId);
    }
  }
  return [...ids];
}
