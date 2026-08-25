/**
 * The runtime half of the language registry.
 *
 * Two properties are worth holding, and they are the two the build-time registry
 * already has: a tag with no module is answered rather than crashed on, and an
 * accent resolves to its language. The third is this half's own — the answer to
 * "is there a chart" arrives *synchronously*, because a section that appears a
 * frame after every other section is a tab that moves under a thumb.
 */

import { describe, expect, it } from 'vitest';
import { alphabetGuide } from '../../src/languages/runtime';

describe('the alphabet registry', () => {
  it('says whether a language has a chart without loading one', () => {
    expect(alphabetGuide('es')).toBeTypeOf('function');
    expect(alphabetGuide('de')).toBeUndefined();
    expect(alphabetGuide('el')).toBeUndefined();
  });

  it('resolves an accent to its language, because an accent is not an alphabet', () => {
    expect(alphabetGuide('es-MX')).toBeTypeOf('function');
    expect(alphabetGuide('es-419')).toBeTypeOf('function');
  });

  it('loads the twenty-seven letters when asked', async () => {
    const load = alphabetGuide('es');
    expect(load).toBeDefined();

    const guide = await load!();
    expect(guide.tag).toBe('es');
    expect(guide.letters).toHaveLength(27);
    expect(guide.letters.map((letter) => letter.letter).join('')).toBe(
      'abcdefghijklmnñopqrstuvwxyz',
    );
    expect(guide.digraphs.map((entry) => entry.letter)).toContain('ll');
  });
});
