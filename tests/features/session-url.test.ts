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
        usableIn: 'es-MX',
      },
      passage: 'mercado',
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
    const url = parse('/session?preset=nonsense&type=bogus&level=z9&order=sideways&region=fr-FR');

    expect(url.preset).toBe('quick');
    expect(url.filter).toEqual({});
    expect(url.ordering).toBeUndefined();
  });

  it('keeps the region macro-filter, not only the pronunciation locales', () => {
    expect(parse('/session?preset=quick&region=es-419').filter.usableIn).toBe('es-419');
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
});
