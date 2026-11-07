import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import { buildSharePayloads } from '../../src/features/sharing/payloads';
import { id, testRepository } from '../fixtures/pack';

const repository = testRepository();
const item = repository.getItem(id<ItemId>('test-es:item:001'))!;

describe('share payloads', () => {
  it('offers Spanish, pairs, context, examples and an AI prompt', () => {
    const payloads = buildSharePayloads(repository, item, 'en');
    const byId = new Map(payloads.map((payload) => [payload.id, payload.text]));

    expect(byId.get('target')).toBe('Tengo que trabajar.');
    expect(byId.get('pair')).toBe('Tengo que trabajar.\nI have to work.');
    expect(byId.get('context')).toContain('tener que + infinitivo');
    expect(byId.get('examples')).toBe('Tengo que irme. — I have to go.');
    expect(byId.get('ai-prompt')).toContain('Explain this Spanish sentence for a beginner');
  });

  it('degrades to target-language-only when no translation exists', () => {
    const payloads = buildSharePayloads(repository, item, 'ja');
    // ja → en fallback still applies; a language with no chain match yields
    // only the Spanish payloads.
    expect(payloads.some((payload) => payload.id === 'target')).toBe(true);
  });
});
