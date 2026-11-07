/**
 * A failed listen has to name a cause the learner can act on.
 *
 * The bug this was written for: Android Chrome does not recognise anything
 * itself — it hands the audio to a separate system app — so a device with no
 * Spanish downloaded fails every listen, and the app sent that learner to a
 * microphone permission that was never blocked. The advice has to differ by
 * platform, and `service-not-allowed` has to stop sharing a branch with
 * `not-allowed`.
 */

import { describe, expect, it } from 'vitest';
import {
  describeSpeechFailure,
  detectSpeechPlatform,
  MICROPHONE_BUSY,
  readSpeechEnvironment,
  SPEECH_INSECURE_CONTEXT,
  SPEECH_UNAVAILABLE,
} from '../../src/audio';

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

describe('the platform speech advice is written for', () => {
  it('separates Android, iOS and the desktop', () => {
    expect(detectSpeechPlatform(ANDROID)).toBe('android');
    expect(detectSpeechPlatform(IPHONE)).toBe('ios');
    expect(detectSpeechPlatform(MAC)).toBe('desktop');
  });

  it('reads an iPad as iOS, which its user agent alone cannot say', () => {
    // iPadOS reports a Macintosh, so touch points are the only thing left.
    expect(detectSpeechPlatform(IPAD, 5)).toBe('ios');
    expect(detectSpeechPlatform(IPAD, 0)).toBe('desktop');
  });

  it('treats an unreadable environment as working rather than broken', () => {
    // Absent means "cannot tell". Claiming an insecure page or a dead
    // connection on that basis is a false alarm about the one thing a learner
    // cannot check for themselves.
    const environment = readSpeechEnvironment({ userAgent: MAC });

    expect(environment.secureContext).toBe(true);
    expect(environment.online).toBe(true);
    expect(environment.platform).toBe('desktop');
  });

  it('reports what it is given', () => {
    const environment = readSpeechEnvironment({
      userAgent: ANDROID,
      secureContext: false,
      online: false,
      microphone: false,
    });

    expect(environment).toEqual({
      secureContext: false,
      microphone: false,
      online: false,
      platform: 'android',
    });
  });
});

describe('describing a failed listen', () => {
  it('sends a refused speech service to the recogniser, not to the microphone', () => {
    const android = describeSpeechFailure('service-not-allowed', {
      platform: 'android',
      locale: 'es-MX',
    });

    // The distinction the two shared a branch on: this is not a permission.
    expect(android.summary).toContain('The microphone is not the problem');
    expect(android.steps.join(' ')).toContain('Speech Services by Google');
    expect(android.steps.join(' ')).toContain('es-MX');
    expect(android.steps.join(' ')).not.toContain('padlock');
  });

  it('sends a blocked permission to the browser, and names the right settings', () => {
    const android = describeSpeechFailure('not-allowed', { platform: 'android' });
    const ios = describeSpeechFailure('not-allowed', { platform: 'ios' });
    const desktop = describeSpeechFailure('not-allowed', { platform: 'desktop' });

    expect(android.steps.join(' ')).toContain('Settings → Apps → Chrome');
    expect(ios.steps.join(' ')).toContain('Settings → Safari → Microphone');
    expect(desktop.steps.join(' ')).toContain('padlock');
  });

  it('says a missing language is the device’s on a phone and the browser’s on a desktop', () => {
    expect(describeSpeechFailure('language-not-supported', { locale: 'es-ES' }).summary).toBe(
      'This browser cannot recognise es-ES.',
    );
    expect(
      describeSpeechFailure('language-not-supported', { platform: 'android', locale: 'es-ES' })
        .summary,
    ).toBe('This device has no speech recognition installed for es-ES.');
  });

  it('tells a learner the meter saw them, rather than telling them to speak up', () => {
    const audible = describeSpeechFailure('no-speech', { audible: true, platform: 'android' });
    const silent = describeSpeechFailure('no-speech', { audible: false, platform: 'android' });

    expect(audible.summary).toContain('Your microphone is working');
    expect(audible.steps.join(' ')).toContain('Speech Services by Google');
    expect(silent.summary).toContain('a little louder');
    // "Speak up" is the wrong fix for a recogniser that is not installed, and
    // the right one for a learner who mumbled. They must not swap advice.
    expect(silent.steps.join(' ')).not.toContain('Speech Services by Google');
  });

  it('offers offline recognition as the answer to a network failure on Android', () => {
    expect(describeSpeechFailure('network', { platform: 'android' }).steps.join(' ')).toContain(
      'offline',
    );
    expect(describeSpeechFailure('network', { platform: 'desktop' }).steps.join(' ')).toContain(
      'Reconnect',
    );
  });

  it('keeps the reason it was given, so a learner can quote it', () => {
    for (const reason of [
      'no-speech',
      'not-allowed',
      'service-not-allowed',
      'network',
      'language-not-supported',
      'audio-capture',
      MICROPHONE_BUSY,
      SPEECH_INSECURE_CONTEXT,
      SPEECH_UNAVAILABLE,
      'something-a-browser-invented',
    ]) {
      expect(describeSpeechFailure(reason).reason).toBe(reason);
      expect(describeSpeechFailure(reason).summary.length).toBeGreaterThan(0);
    }
  });

  it('falls back to a usable sentence for a reason nothing here knows', () => {
    const unknown = describeSpeechFailure('something-a-browser-invented');

    expect(unknown.summary).toContain('Rate yourself instead');
    // No steps rather than invented ones: advice for an unknown cause is noise.
    expect(unknown.steps).toEqual([]);
  });
});
