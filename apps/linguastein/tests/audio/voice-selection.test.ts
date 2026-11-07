/**
 * Voice selection decides whether Spanish sounds Spanish, so it is tested
 * directly against the shapes browsers actually report.
 */

import { describe, expect, it } from 'vitest';
import { selectVoice } from '../../src/audio/web-speech-provider';

const voice = (name: string, lang: string, isDefault = false): SpeechSynthesisVoice =>
  ({
    name,
    lang,
    default: isDefault,
    localService: true,
    voiceURI: name,
  }) as SpeechSynthesisVoice;

const VOICES = [
  voice('Microsoft David - English (United States)', 'en-US', true),
  voice('Google español', 'es-ES'),
  voice('Microsoft Sabina - Spanish (Mexico)', 'es-MX'),
  voice('Google español de Estados Unidos', 'es-US'),
];

describe('selectVoice', () => {
  it('prefers an exact locale match', () => {
    expect(selectVoice(VOICES, 'es-MX')?.name).toBe('Microsoft Sabina - Spanish (Mexico)');
    expect(selectVoice(VOICES, 'es-ES')?.name).toBe('Google español');
  });

  it('falls back to another voice of the same language', () => {
    // No es-AR voice installed: any Spanish voice beats an English one.
    expect(selectVoice(VOICES, 'es-AR')?.lang.startsWith('es')).toBe(true);
  });

  it('never crosses languages — the English default is not a Spanish voice', () => {
    const englishOnly = [VOICES[0]!];
    expect(selectVoice(englishOnly, 'es-ES')).toBeUndefined();
    expect(selectVoice([], 'es-ES')).toBeUndefined();
  });

  it('accepts platform tags written with an underscore', () => {
    const underscored = [voice('Spanish', 'es_ES')];
    expect(selectVoice(underscored, 'es-ES')?.name).toBe('Spanish');
  });

  it('honours an explicit choice when it speaks the right language', () => {
    expect(selectVoice(VOICES, 'es-ES', 'Microsoft Sabina - Spanish (Mexico)')?.lang).toBe('es-MX');
    // A stale choice from another language is ignored, not obeyed.
    expect(selectVoice(VOICES, 'es-ES', 'Microsoft David - English (United States)')?.name).toBe(
      'Google español',
    );
  });

  it('is stable across calls', () => {
    const first = selectVoice(VOICES, 'es-AR')?.name;
    const second = selectVoice([...VOICES].reverse(), 'es-AR')?.name;
    expect(first).toBe(second);
  });
});
