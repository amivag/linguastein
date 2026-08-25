/**
 * Why a listen failed, and what to do about it — in one place.
 *
 * Two surfaces ask this question: a speaking exercise, which has room for one
 * sentence, and the Audio settings check, which has room for the steps. They
 * were never going to stay in agreement as two switch statements, and the one
 * that would have drifted is the exercise's — the terse one, read mid-practice,
 * by someone who has already decided the feature is broken.
 *
 * The advice is platform-shaped because the fix is: on Android recognition is a
 * separate system app, on iOS it is Dictation, and on a desktop it is usually
 * the browser's own permission. Naming the wrong settings screen is worse than
 * naming none.
 */

import type { SpeechPlatform } from './support';
import { MICROPHONE_BUSY, SPEECH_INSECURE_CONTEXT, SPEECH_UNAVAILABLE } from './types';

export interface SpeechFailure {
  /** The raw reason, kept so a learner can quote it in a bug report. */
  readonly reason: string;
  /** One sentence, for a surface with room for one sentence. */
  readonly summary: string;
  /** What to go and change, most likely cause first. Possibly empty. */
  readonly steps: readonly string[];
}

export interface SpeechFailureContext {
  /** Whether the level meter saw anything. See `no-speech` below. */
  readonly audible?: boolean | undefined;
  readonly platform?: SpeechPlatform | undefined;
  /** The accent that was asked for, e.g. `es-MX`. */
  readonly locale?: string | undefined;
}

/** The microphone permission, which belongs to the browser and to the site. */
function permissionSteps(platform: SpeechPlatform): readonly string[] {
  switch (platform) {
    case 'android':
      return [
        'Tap the padlock beside the address bar, then Permissions, and allow the microphone for this site.',
        'Check Android Settings → Apps → Chrome → Permissions → Microphone as well: a block there overrides the site.',
      ];
    case 'ios':
      return [
        'Check Settings → Safari → Microphone and allow it for this site.',
        'An app installed to the Home Screen holds its own permission, separate from Safari’s.',
      ];
    case 'desktop':
      return [
        'Open the padlock beside the address bar and allow the microphone for this site.',
        'Check the operating system’s privacy settings too — a browser blocked there cannot even ask.',
      ];
  }
}

/**
 * The recogniser itself, which on a phone is not the browser.
 *
 * This is the advice the app was missing entirely. Chrome on Android does not
 * recognise anything: it hands the audio to Speech Services by Google. With that
 * service disabled, or with the language never downloaded, every listen fails in
 * a way that looks like a broken microphone and is not.
 */
function recogniserSteps(platform: SpeechPlatform, locale: string | undefined): readonly string[] {
  const language = locale ?? 'the accent you practise in';
  switch (platform) {
    case 'android':
      return [
        'Android recognises speech through a separate app: check Settings → Apps → Speech Services by Google is installed and enabled.',
        `Open its language list and download ${language}. Without it, recognition needs a connection — and often fails anyway.`,
        'Some devices also need Google chosen as the speech engine, under Settings → System → Languages & input.',
      ];
    case 'ios':
      return [
        'iOS recognises speech through Dictation: turn it on in Settings → General → Keyboard → Enable Dictation.',
        `Add ${language} under Settings → General → Keyboard → Keyboards, so Dictation can offer it.`,
      ];
    case 'desktop':
      return [
        'Chrome and Edge transcribe through their own online service, so this needs a working connection.',
        'Firefox has no speech recogniser at all — use Chrome, Edge or Safari for this check.',
      ];
  }
}

/**
 * What went wrong, in terms of something the learner can change.
 *
 * `audible` is what the level meter saw, and it is the difference between two
 * failures that report the same reason. A recogniser that returns nothing while
 * the microphone is plainly working is not a learner who mumbled: on Android it
 * is usually a recogniser that needed the network, or one that lost the
 * microphone to another app mid-listen. Telling someone to speak up in that case
 * sends them to fix the one thing that is not broken.
 */
export function describeSpeechFailure(
  reason: string,
  context: SpeechFailureContext = {},
): SpeechFailure {
  const platform = context.platform ?? 'desktop';
  const { locale } = context;
  const failure = (summary: string, steps: readonly string[] = []): SpeechFailure => ({
    reason,
    summary,
    steps,
  });

  switch (reason) {
    case 'no-speech':
      return context.audible
        ? failure(
            'Your microphone is working, but the recogniser returned nothing. It may need a connection, or another app may have taken the microphone.',
            recogniserSteps(platform, locale),
          )
        : failure('I did not hear anything — try again a little louder.', [
            'Watch the level while you speak: if it does not move, the microphone is not reaching this page.',
            'On a headset, check the boom microphone is not muted at the cable.',
          ]);

    case 'not-allowed':
      return failure(
        'Microphone access was blocked. Allow it for this site in your browser settings, then try again.',
        permissionSteps(platform),
      );

    /*
     * Distinct from the permission above, and the distinction is the point: this
     * is the recognition *service* refusing, which no amount of granting the
     * microphone will fix. The two shared a branch until a learner on Android
     * was sent to unblock a permission that was never blocked.
     */
    case 'service-not-allowed':
      return failure(
        'The speech service refused this listen. The microphone is not the problem — the recogniser behind it is.',
        recogniserSteps(platform, locale),
      );

    case MICROPHONE_BUSY:
      return failure(
        'Something else is using the microphone. Close it — a call, another tab — and try again.',
        [
          'End any call, voice note or recording, then try again.',
          'Other tabs count: a meeting left open in the background holds the device.',
        ],
      );

    case 'audio-capture':
      return failure('No microphone was available to listen with.', [
        'Check a microphone is connected, and not muted by a hardware switch.',
        ...permissionSteps(platform),
      ]);

    case SPEECH_INSECURE_CONTEXT:
      return failure(
        'Speech input needs a secure page. Open the installed app or the https address rather than a plain http one.',
        ['Load this page over https, or open the installed app, and try again.'],
      );

    case 'network':
      return failure(
        'Speech recognition needs a connection on this browser.',
        platform === 'android'
          ? [
              'Reconnect, or download the language inside Speech Services by Google so recognition works offline.',
              ...recogniserSteps(platform, locale),
            ]
          : [
              'Reconnect and try again — the audio is transcribed by a service, not by the browser.',
            ],
      );

    case 'language-not-supported':
      return failure(
        platform === 'desktop'
          ? `This browser cannot recognise ${locale ?? 'this language'}.`
          : `This device has no speech recognition installed for ${locale ?? 'this language'}.`,
        recogniserSteps(platform, locale),
      );

    case SPEECH_UNAVAILABLE:
      return failure('This browser has no speech recogniser.', recogniserSteps(platform, locale));

    default:
      return failure('Speech check is unavailable right now. Rate yourself instead.', []);
  }
}
