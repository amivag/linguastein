/**
 * Named practice presets — the small, useful subset of session options the
 * first UI exposes (spec §5). Everything here is just a `SessionConfig`
 * factory; the planner and the engine know nothing about presets.
 */

import type { IconName } from '../../components/Icon';
import type { ContentRepository, ItemFilter } from '../../domain/content';
import type { ExerciseKind } from '../../domain/exercises';
import type { Ordering, SessionConfig, SessionFocus, SessionSize } from '../../domain/sessions';
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
  /**
   * The glyph Home shows beside the name.
   *
   * It lives with the preset rather than in a lookup table on the screen, for
   * the same reason the label does: adding a seventh preset should be one entry
   * in this file, not one here and one in a map somewhere that a reviewer has to
   * notice is missing. `mode` already says whether the preset records anything,
   * so the screen tints the icon from that and does not need a second flag.
   */
  readonly icon: IconName;
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
    icon: 'quick',
    // The set the composer may draw on; it picks per item by memory strength.
    exerciseKinds: [
      'multiple-choice',
      'cloze-choice',
      'tap-to-build',
      'think-say',
      'listen-repeat',
    ],
    mode: 'practice',
    ordering: 'smart',
    filter: () => ({}),
  },
  listen: {
    id: 'listen',
    label: 'Listen & repeat',
    description: 'Hear it, say it back, check yourself',
    icon: 'listen',
    exerciseKinds: ['listen-repeat'],
    mode: 'practice',
    ordering: 'smart',
    filter: () => ({ types: ['sentence', 'phrase'] }),
  },
  speaking: {
    id: 'speaking',
    label: 'Think & say',
    description: 'Say the Spanish before you reveal it',
    icon: 'record',
    exerciseKinds: ['think-say'],
    mode: 'practice',
    ordering: 'smart',
    filter: () => ({ types: ['sentence', 'phrase'] }),
  },
  flashcards: {
    id: 'flashcards',
    label: 'Flashcards',
    description: 'See it, say it, reveal the meaning',
    icon: 'study',
    exerciseKinds: ['reveal'],
    mode: 'study',
    /**
     * Random, not pack order. `sequential` meant this button dealt the first ten
     * items of the pack every single time it was pressed — for the whole life of
     * the install — which is how "I always see the same material" happens
     * without a single line of the scheduler being wrong. Pack order is still
     * reachable with `?order=sequential`, which is where a passage that has to
     * be read in order asks for it.
     */
    ordering: 'random',
    filter: () => ({}),
  },
  verbs: {
    id: 'verbs',
    label: 'Verbs',
    description: 'Useful forms inside natural sentences',
    icon: 'grammar',
    exerciseKinds: [
      'cloze-choice',
      'multiple-choice',
      'tap-to-build',
      'think-say',
      'listen-repeat',
    ],
    mode: 'practice',
    ordering: 'smart',
    // "Verbs" as a kind, not as the list of every verb lexeme in the pack: the
    // repository already knows which items exemplify one, and enumerating them
    // here meant a second such set would be a second enumeration.
    filter: () => ({ pos: ['VERB'] }),
  },
  vocabulary: {
    id: 'vocabulary',
    label: 'Vocabulary',
    description: 'Words, with examples in context',
    icon: 'word',
    exerciseKinds: ['multiple-choice', 'think-say', 'reveal', 'listen-repeat'],
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
  readonly dueOnly?: boolean;
  readonly focus?: SessionFocus;
  /**
   * The course: which packs and which levels are in play at all.
   *
   * Separate from `scope` because the two mean different things to the new-item
   * cap below. A course is the standing context — being in one is not a
   * deliberate choice of set — whereas a scope is a learner pointing at
   * something specific. Folding the course into `scope` would make every
   * session look hand-picked and switch the cap off everywhere.
   */
  readonly courseScope?: ItemFilter;
  /** Narrows the preset further, e.g. to the sentences of one passage. */
  readonly scope?: ItemFilter;
}

/**
 * How much unseen material an open-ended session may mix in. It exists to stop
 * "10 minutes of practice" turning into ten first encounters — so it must not
 * apply to a set the learner picked deliberately: capping a 12-sentence passage
 * at 8 would silently practise two thirds of what the button offered.
 */
const NEW_ITEM_CAP = 8;

export function buildSessionConfig(preset: Preset, options: BuildConfigOptions): SessionConfig {
  const scoped = options.scope !== undefined && Object.keys(options.scope).length > 0;

  return {
    mode: preset.mode,
    filter: { ...preset.filter(options.repository), ...options.courseScope, ...options.scope },
    size: options.size,
    ordering: options.ordering ?? preset.ordering,
    exerciseKinds: preset.exerciseKinds,
    referenceLanguage: options.preferences.referenceLanguage,
    pronunciationLocale: options.preferences.pronunciationLocale,
    ...(scoped ? {} : { maxNewItems: NEW_ITEM_CAP }),
    ...(options.dueOnly ? { dueOnly: true } : {}),
    ...(options.focus ? { focus: options.focus } : {}),
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
