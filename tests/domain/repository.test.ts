import { describe, expect, it } from 'vitest';
import { id, testRepository } from '../fixtures/pack';
import type { ItemId, LexemeId } from '../../src/domain/content';

describe('ContentRepository', () => {
  const repository = testRepository();

  it('indexes items in stable pack order', () => {
    expect(repository.itemCount).toBe(7);
    expect(repository.allItems()[0]?.text).toBe('Tengo que trabajar.');
  });

  it('filters by type, topic and lexeme', () => {
    expect(repository.query({ types: ['word'] })).toHaveLength(4);
    expect(repository.query({ topics: ['food-drink'] })).toHaveLength(4);
    expect(repository.query({ lexemes: [id<LexemeId>('test-es:lexeme:tener')] })).toHaveLength(2);
  });

  it('matches search without diacritics', () => {
    expect(repository.query({ search: 'cafe' })).toHaveLength(1);
    expect(repository.query({ search: 'TIENES' })).toHaveLength(1);
  });

  it('resolves translations through the reference-language fallback chain', () => {
    const item = id<ItemId>('test-es:item:004');
    expect(repository.translationOf(item, 'de')?.text).toBe('Bier');
    // el-GR has no translation: el → en fallback (spec §11.1).
    expect(repository.translationOf(item, 'el-GR')?.text).toBe('beer');
    // No translation at all means target-language-only mode, not a crash.
    expect(repository.translationOf(id<ItemId>('test-es:item:999'), 'en')).toBeUndefined();
  });

  it('picks audio for the preferred pronunciation locale', () => {
    const item = repository.getItem(id<ItemId>('test-es:item:001'));
    expect(item).toBeDefined();
    expect(repository.audioOf(item!, 'es-MX')?.src).toContain('es-MX');
    // Unknown regional variant falls back to another Spanish locale.
    expect(repository.audioOf(item!, 'es-AR')?.locale).toBe('es-ES');
  });

  it('exposes facets for filter UIs', () => {
    const facets = repository.facets();
    expect(facets.types).toEqual(['sentence', 'word']);
    expect(facets.topics).toContain('food-drink');
    expect(facets.levels).toEqual(['a1']);
  });
});
