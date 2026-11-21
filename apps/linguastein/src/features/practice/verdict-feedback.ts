/**
 * The sound and the buzz that may accompany a checked answer.
 *
 * Only ever an accompaniment: the verdict itself is the `role="status"` text and
 * the styling `ExerciseView` already renders, so a learner with both switched off
 * — the default — loses nothing, and one with them on hears what they can
 * already read (`docs/tasks/game-feel.md` §3, §4.6).
 *
 * Called from the answer handler, never from render: both make a noise.
 */

import type { Haptics } from '@platform/web';
import type { AudioService } from '../../audio';
import type { Preferences } from '../../storage';

export function signalVerdict(
  devices: { readonly audio: AudioService; readonly haptics: Haptics },
  preferences: Pick<Preferences, 'feedbackSound' | 'feedbackHaptics'>,
  correct: boolean,
): void {
  if (preferences.feedbackSound) devices.audio.cue(correct ? 'correct' : 'incorrect');
  if (preferences.feedbackHaptics) devices.haptics.pulse(correct ? 'confirm' : 'miss');
}
