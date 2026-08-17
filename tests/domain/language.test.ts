import { describe, expect, it } from 'vitest';
import {
  baseLanguage,
  deriveTokenSpans,
  parseEntityId,
  referenceLanguageChain,
  resolvePronunciationLocale,
} from '../../src/domain/content';

describe('language resolution', () => {
  it('builds the reference-language fallback chain', () => {
    expect(referenceLanguageChain('el-GR')).toEqual(['el-GR', 'el', 'en']);
    expect(referenceLanguageChain('pt-BR')).toEqual(['pt-BR', 'pt', 'en']);
    // No duplicates when the selection already is the fallback.
    expect(referenceLanguageChain('en')).toEqual(['en']);
  });

  it('reduces a tag to its base language', () => {
    expect(baseLanguage('es-MX')).toBe('es');
    expect(baseLanguage('es')).toBe('es');
  });

  it('matches a pronunciation locale within the same language', () => {
    const available = ['es-ES', 'es-MX'];
    expect(resolvePronunciationLocale(available, 'es-MX')).toBe('es-MX');
    expect(resolvePronunciationLocale(available, 'es-AR')).toBe('es-ES');
    expect(resolvePronunciationLocale([], 'es-ES')).toBeUndefined();
  });
});

describe('entity ids', () => {
  it('parses namespaced ids', () => {
    expect(parseEntityId('core-es:item:000001')).toEqual({
      namespace: 'core-es',
      kind: 'item',
      local: '000001',
    });
  });

  it('rejects malformed ids', () => {
    expect(parseEntityId('core-es:widget:1')).toBeNull();
    expect(parseEntityId('CoreES:item:1')).toBeNull();
    expect(parseEntityId('item:1')).toBeNull();
  });
});

describe('token spans', () => {
  it('derives character offsets instead of storing them', () => {
    const spans = deriveTokenSpans('Tengo que trabajar.', [
      { id: 't1', text: 'Tengo' },
      { id: 't2', text: 'que' },
      { id: 't3', text: 'trabajar' },
    ]);

    expect(spans).toEqual([
      { id: 't1', start: 0, end: 5 },
      { id: 't2', start: 6, end: 9 },
      { id: 't3', start: 10, end: 18 },
    ]);
  });
});
