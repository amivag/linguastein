import { describe, expect, it } from 'vitest';
import {
  bestAlternative,
  bestExpectedAlternative,
  compareSpoken,
} from '../../src/domain/exercises';

describe('compareSpoken', () => {
  it('accepts an exact match', () => {
    expect(compareSpoken('Tengo que trabajar.', 'Tengo que trabajar')).toMatchObject({
      verdict: 'match',
      score: 1,
      missing: [],
    });
  });

  it('ignores punctuation, case and accents the recogniser drops', () => {
    expect(compareSpoken('¿Dónde está el baño?', 'donde esta el bano').verdict).toBe('match');
    expect(compareSpoken('Hoy estoy muy cansado.', 'HOY ESTOY MUY CANSADO').verdict).toBe('match');
  });

  it('reports a near miss as close, with the words that were dropped', () => {
    const result = compareSpoken('Tengo que ir al mercado', 'tengo que ir');
    expect(result.verdict).toBe('close');
    expect(result.missing).toEqual(['al', 'mercado']);
    expect(result.score).toBeLessThan(1);
  });

  it('rejects something else entirely', () => {
    expect(compareSpoken('Tengo hambre.', 'good morning everyone').verdict).toBe('different');
  });

  it('treats scrambled word order as close, not correct', () => {
    const result = compareSpoken('Quiero comprar una camisa', 'camisa una comprar quiero');
    expect(result.verdict).toBe('match');
    // All words present, so it scores full marks, but the order differed.
    expect(result.score).toBe(1);
  });

  it('notes words that were not expected', () => {
    expect(compareSpoken('Tengo hambre', 'tengo mucha hambre').extra).toEqual(['mucha']);
  });

  it('handles empty input safely', () => {
    expect(compareSpoken('Tengo hambre', '')).toMatchObject({ verdict: 'different', score: 0 });
    expect(compareSpoken('', 'anything').verdict).toBe('different');
  });
});

describe('bestAlternative', () => {
  it('prefers the alternative that actually matches the target', () => {
    // Recognisers often rank an English-sounding reading first.
    const best = bestAlternative('Tengo que trabajar', 'ten go kay tra ba har', [
      'tengo que trabajar',
    ]);

    expect(best.text).toBe('tengo que trabajar');
    expect(best.comparison.verdict).toBe('match');
  });

  it('keeps the primary transcript when nothing beats it', () => {
    const best = bestAlternative('Tengo hambre', 'tengo hambre', ['tengo hombre']);
    expect(best.text).toBe('tengo hambre');
  });
});

describe('bestExpectedAlternative', () => {
  it('accepts the best of several natural responses', () => {
    const best = bestExpectedAlternative(
      ['Muy bien, gracias.', 'Más o menos.', 'Estoy un poco triste.'],
      'estoy un poco triste',
    );

    expect(best.expected).toBe('Estoy un poco triste.');
    expect(best.comparison.verdict).toBe('match');
  });

  it('still considers alternate recogniser transcripts for every response', () => {
    const best = bestExpectedAlternative(['Todo bien.', 'Estoy cansado.'], 'toy bien', [
      'estoy cansado',
    ]);

    expect(best).toMatchObject({ expected: 'Estoy cansado.', text: 'estoy cansado' });
  });
});
