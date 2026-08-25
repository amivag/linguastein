/**
 * The session URL is the session's contract with reloads, shares and agents, so
 * both directions are tested together: anything `sessionPath` can write,
 * `parseSessionUrl` must read back.
 */

import { describe, expect, it } from 'vitest';
import type { Course } from '../../src/domain/content';
import {
  parseSessionUrl,
  sessionPath,
  type SessionUrl,
} from '../../src/features/practice/session-url';

const parse = (path: string): SessionUrl =>
  parseSessionUrl(new URLSearchParams(path.slice(path.indexOf('?') + 1)));

const COURSE: Course = { language: 'es', level: 'a1' };

describe('sessionPath', () => {
  it('round-trips everything a session can express', () => {
    const input = {
      preset: 'quick',
      size: { kind: 'items', count: 15 },
      filter: {
        search: 'café',
        types: ['word'],
        levels: ['a1'],
        topics: ['food-drink'],
        registers: ['colloquial'],
        moods: ['question'],
        usableIn: 'es-MX',
      },
      passage: 'mercado',
      batch: 'batch-lq2p8v-k3f9a1',
      mission: 'market-shopping',
      skills: ['preterite'],
      dueOnly: true,
      ordering: 'random',
      seed: 42,
    } as const;

    expect(parse(sessionPath(COURSE, input))).toEqual(input);
  });

  it('omits what was not asked for, so a plain link stays readable', () => {
    expect(sessionPath(COURSE, { preset: 'listen', size: { kind: 'time', minutes: 5 } })).toBe(
      '/es/a1/session?preset=listen&size=time%3A5',
    );
  });

  /**
   * The course is the path, not the query. A session that dropped it would
   * replan against every pack loaded the moment the link was reopened.
   */
  it('hangs the session off the course it belongs to', () => {
    expect(
      sessionPath({ language: 'fr', level: 'all' }, { preset: 'quick', size: { kind: 'all' } }),
    ).toBe('/fr/all/session?preset=quick&size=all');
  });
});

describe('parseSessionUrl', () => {
  it('reads the faceted filter a learner picked in Browse', () => {
    const url = parse('/session?preset=quick&size=items:10&type=word&topic=food-drink&level=a1');

    expect(url.filter).toEqual({ types: ['word'], topics: ['food-drink'], levels: ['a1'] });
  });

  it('accepts several values per facet, for scripted sessions', () => {
    const url = parse('/session?preset=quick&type=word,phrase&topic=work,everyday');

    expect(url.filter.types).toEqual(['word', 'phrase']);
    expect(url.filter.topics).toEqual(['work', 'everyday']);
  });

  /**
   * A dropped value widens the session; a rejected one would empty it. An
   * unknown facet must not be mistaken for "match nothing".
   */
  it('drops values the domain does not recognise rather than emptying the session', () => {
    const url = parse('/session?preset=nonsense&type=bogus&level=z9&order=sideways');

    expect(url.preset).toBe('quick');
    expect(url.filter).toEqual({});
    expect(url.ordering).toBeUndefined();
  });

  it('keeps the region macro-filter, not only the pronunciation locales', () => {
    expect(parse('/session?preset=quick&region=es-419').filter.usableIn).toBe('es-419');
  });

  /**
   * A region is pack vocabulary, like a topic and unlike a level, so it is
   * carried rather than checked off a list here. `region=fr-FR` used to be
   * dropped — which was the right instinct enforced by the wrong list, five
   * Spanish locales that no English or German pack appears in.
   *
   * Carrying it cannot empty a session, which is what the closed list was
   * protecting: region-neutral content passes `isUsableIn` whatever the locale,
   * so an unserviceable region narrows to that material instead of to nothing.
   * A topic no pack declares is already less forgiving than this.
   */
  it('carries a region no loaded pack has heard of, rather than dropping it', () => {
    expect(parse('/session?preset=quick&region=en-GB').filter.usableIn).toBe('en-GB');
  });

  it('canonicalises the casing, because the content declares one spelling', () => {
    expect(parse('/session?preset=quick&region=es-es').filter.usableIn).toBe('es-ES');
    expect(parse('/session?preset=quick&region=ZH-hant').filter.usableIn).toBe('zh-Hant');
    expect(parse('/session?preset=quick&region=es-419').filter.usableIn).toBe('es-419');
  });

  it('still refuses what is not a language tag at all', () => {
    expect(parse('/session?preset=quick&region=sideways!').filter.usableIn).toBeUndefined();
    expect(parse('/session?preset=quick&region=x').filter.usableIn).toBeUndefined();
  });

  it('reads due in the forms a human would type, and only those', () => {
    expect(parse('/session?preset=quick&due=1').dueOnly).toBe(true);
    expect(parse('/session?preset=quick&due=true').dueOnly).toBe(true);
    expect(parse('/session?preset=quick&due').dueOnly).toBe(true);
    expect(parse('/session?preset=quick&due=0').dueOnly).toBeUndefined();
    expect(parse('/session?preset=quick&due=false').dueOnly).toBeUndefined();
    expect(parse('/session?preset=quick').dueOnly).toBeUndefined();
  });

  it('carries a seed so a shared link plans the same set twice', () => {
    expect(parse('/session?preset=quick&seed=7').seed).toBe(7);
    expect(parse('/session?preset=quick&seed=notanumber').seed).toBeUndefined();
  });

  it('ignores the "all" sentinel the Browse selects use for "no filter"', () => {
    expect(parse('/session?preset=quick&topic=all').filter.topics).toBeUndefined();
    expect(parse('/session?preset=quick&skill=all').skills).toBeUndefined();
  });

  /**
   * Skills are the one way to ask for a tense — the pack attaches
   * `preterite` and `imperfect` to the sentences that use them — so the link
   * has to carry them or "practise the past" is unreachable.
   */
  it('reads the skills a session was scoped to', () => {
    expect(parse('/session?preset=quick&skill=preterite').skills).toEqual(['preterite']);
    expect(parse('/session?preset=quick&skill=preterite,imperfect').skills).toEqual([
      'preterite',
      'imperfect',
    ]);
  });

  /**
   * Unlike a type or a level, a skill slug is pack vocabulary rather than a
   * domain enum, so this module cannot tell a typo from a slug a pack it has
   * never seen declares. It keeps both and lets the screen resolve them, which
   * is the same division of labour `passage` uses.
   */
  it('keeps a skill slug it cannot validate, and leaves resolution to the screen', () => {
    expect(parse('/session?preset=quick&skill=not-a-skill').skills).toEqual(['not-a-skill']);
  });

  it('does not confuse a skill with a topic of the same name', () => {
    const url = parse('/session?preset=quick&skill=imperative&topic=work');

    expect(url.skills).toEqual(['imperative']);
    expect(url.filter.topics).toEqual(['work']);
    expect(url.filter.skills).toBeUndefined();
  });

  /**
   * A batch travels as its id for the reason `writeItemFilter` refuses `ids`
   * altogether: thirty item ids is not a link. The same division of labour as a
   * passage — this module cannot know which batches exist, so it parses without
   * validating and the screen resolves.
   */
  it('carries a batch as an id and never as its items', () => {
    const path = sessionPath(COURSE, { preset: 'quick', batch: 'batch-1' });

    expect(path).toContain('batch=batch-1');
    expect(path).not.toContain('ids=');
    expect(parse(path).batch).toBe('batch-1');
    expect(parse(path).filter.ids).toBeUndefined();
  });

  it('keeps a batch id it cannot validate, and leaves resolution to the screen', () => {
    expect(parse('/session?preset=quick&batch=gone').batch).toBe('gone');
  });
});
