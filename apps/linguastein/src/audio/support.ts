/**
 * What this device can actually do about speech, before anything is tried.
 *
 * Speech input fails for reasons that live outside the app — a page served over
 * plain HTTP, a browser with no recogniser, an Android speech service with no
 * Spanish downloaded — and every one of them reaches a learner as the same
 * nothing: a button that does not work. Reading the environment up front is what
 * turns that into a sentence somebody can act on.
 *
 * Platform detection here is user-agent sniffing, which is normally the wrong
 * tool. It earns its place for one narrow job: the *fix* differs by platform and
 * nothing else exposes which one you are on. It never gates a capability — every
 * capability below is feature-detected — so a wrong guess costs a paragraph of
 * advice, never a working feature.
 */

/** Which set of speech settings the fix instructions should name. */
export type SpeechPlatform = 'android' | 'ios' | 'desktop';

export interface SpeechEnvironment {
  /** `getUserMedia` and the recogniser both refuse an insecure page. */
  readonly secureContext: boolean;
  /** Whether the browser exposes a microphone at all. */
  readonly microphone: boolean;
  /**
   * Whether the device believes it is online. Best-effort — `onLine` reports a
   * network, not a reachable service — but the common Android failure is a
   * recogniser that needed a connection, so it is worth saying.
   */
  readonly online: boolean;
  readonly platform: SpeechPlatform;
}

/** The globals this reads, overridable so the logic can be tested off-browser. */
export interface SpeechEnvironmentSource {
  readonly secureContext?: boolean | undefined;
  readonly userAgent?: string | undefined;
  readonly online?: boolean | undefined;
  readonly touchPoints?: number | undefined;
  readonly microphone?: boolean | undefined;
}

/**
 * `android`, `ios` or `desktop` from a user-agent string.
 *
 * iPadOS reports a Macintosh user agent, so touch points are the only thing
 * separating an iPad from a Mac. A Mac reports 0 and every iPad reports 5.
 */
export function detectSpeechPlatform(userAgent: string, touchPoints = 0): SpeechPlatform {
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  if (/macintosh/i.test(userAgent) && touchPoints > 1) return 'ios';
  return 'desktop';
}

export function readSpeechEnvironment(source: SpeechEnvironmentSource = {}): SpeechEnvironment {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const userAgent = source.userAgent ?? nav?.userAgent ?? '';
  const touchPoints = source.touchPoints ?? nav?.maxTouchPoints ?? 0;

  return {
    // Absent means "cannot tell", and the honest reading of that is "fine":
    // claiming an insecure page in a test environment would be a false alarm.
    secureContext: source.secureContext ?? globalThis.isSecureContext !== false,
    microphone: source.microphone ?? nav?.mediaDevices?.getUserMedia !== undefined,
    online: source.online ?? nav?.onLine !== false,
    platform: detectSpeechPlatform(userAgent, touchPoints),
  };
}
