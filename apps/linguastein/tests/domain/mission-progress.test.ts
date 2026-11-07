/**
 * Where a learner stands in a mission — derived from the attempt log, because
 * nothing writes "mission finished" down.
 *
 * This calculation used to live inside the home screen, which meant Study could
 * not list the missions without copying it. Two screens answering the same
 * question differently is the failure this file is here to prevent, so the
 * assertions are about the answer rather than about either screen.
 */

import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../../src/app/missions';
import { ContentRepository } from '../../src/domain/content';
import type { ItemId, Passage, PassageId } from '../../src/domain/content';
import {
  isMissionUseSession,
  missionOfUseSession,
  missionStandings,
  missionUseEvidence,
  missionUseSessionId,
  nextMissionStanding,
  type MissionDefinition,
} from '../../src/domain/missions';
import { id, TEST_PACK, testRepository } from '../fixtures/pack';

const course = { language: 'es', level: 'all' } as const;

/** Every item the fixture repository holds, which is the widest course there is. */
function everything(repository: ContentRepository): ReadonlySet<string> {
  return new Set(repository.allItems().map((item) => item.id));
}

describe('a Use-stage session id', () => {
  it('round-trips the mission it belongs to', () => {
    const sessionId = missionUseSessionId('cafe-order', '700015', 'abc123');

    expect(missionOfUseSession(sessionId)).toBe('cafe-order');
    expect(isMissionUseSession(sessionId, 'cafe-order')).toBe(true);
    expect(isMissionUseSession(sessionId, 'ask-directions')).toBe(false);
  });

  it('claims nothing that is not one', () => {
    // Only the Use stage records anything, so an ordinary session id must not be
    // read as evidence for a mission that was never opened.
    expect(missionOfUseSession(undefined)).toBeUndefined();
    expect(missionOfUseSession('session:12345')).toBeUndefined();
    expect(missionOfUseSession('mission:cafe-order:understand:1')).toBeUndefined();
  });
});

describe('missionUseEvidence', () => {
  it('indexes attempts by the mission whose Use stage recorded them', () => {
    const evidence = missionUseEvidence([
      { subject: 'a', sessionId: missionUseSessionId('cafe-order', '700015', '1') },
      { subject: 'b', sessionId: missionUseSessionId('cafe-order', '700021', '2') },
      { subject: 'c', sessionId: missionUseSessionId('make-plans', '700019', '3') },
      { subject: 'd', sessionId: 'quick-session' },
      { subject: 'e' },
    ]);

    expect([...(evidence.get('cafe-order') ?? [])]).toEqual(['a', 'b']);
    expect([...(evidence.get('make-plans') ?? [])]).toEqual(['c']);
    expect(evidence.has('quick-session')).toBe(false);
  });
});

describe('missionStandings', () => {
  it('offers only the missions whose material is in the course', () => {
    /*
     * A course is a scope, so a mission outside it is not a locked feature — it
     * is simply not part of what is being studied. The fixture holds one of the
     * authored missions' passages and none of the others.
     */
    const repository = testRepository();
    const standings = missionStandings(MISSIONS, course, repository, everything(repository), {
      practised: new Set(),
      used: new Map(),
    });

    // Two of the authored missions are built on passages the fixture holds:
    // 700001 teaches the morning routine and 700002 the flat.
    expect(standings.map((standing) => standing.mission.id)).toEqual([
      'morning-routine',
      'your-home',
    ]);
    expect(standings[0]?.position).toBe(1);
    expect(standings[0]?.total).toBe(2);
    expect(standings[0]?.lineCount).toBe(2);
  });

  it('starts every mission in Understand, unfinished', () => {
    const repository = testRepository();
    const [standing] = missionStandings(MISSIONS, course, repository, everything(repository), {
      practised: new Set(),
      used: new Map(),
    });

    expect(standing?.stage).toBe('understand');
    expect(standing?.complete).toBe(false);
    expect(standing?.transfersDone).toBe(0);
  });

  it('moves to Use as soon as the stage has recorded anything', () => {
    // Any Use evidence means the learner has left Understand behind; sending
    // them back to read the exchange again is not where they were.
    const repository = testRepository();
    const [standing] = missionStandings(MISSIONS, course, repository, everything(repository), {
      practised: new Set(),
      used: new Map([['morning-routine', new Set(['test-es:item:001'])]]),
    });

    expect(standing?.stage).toBe('use');
    expect(standing?.complete).toBe(false);
  });

  it('completes a mission without capabilities from ordinary practice', () => {
    /*
     * The two rules are different on purpose. A mission that names capabilities
     * has to see them evidenced *in transfer*; one that names none is finished
     * when its taught exchange has been practised at all.
     */
    const repository = ContentRepository.from([TEST_PACK]);
    const passage = repository.getPassage(id<PassageId>('test-es:passage:700001'));
    const plain: MissionDefinition = {
      id: 'plain',
      language: 'es',
      level: 'a1',
      order: 0,
      title: 'A mission with no named capabilities',
      goal: 'Finish the exchange.',
      passage: '700001',
      spotlight: 0,
      estimatedMinutes: 4,
      scenarioPartner: 'someone',
    };

    const unfinished = missionStandings([plain], course, repository, everything(repository), {
      practised: new Set(['test-es:item:001']),
      used: new Map(),
    });
    const finished = missionStandings([plain], course, repository, everything(repository), {
      practised: new Set(passage?.items ?? []),
      used: new Map(),
    });

    expect(unfinished[0]?.complete).toBe(false);
    expect(finished[0]?.complete).toBe(true);
  });

  it('counts a transfer rung as done only when its learner lines are evidenced', () => {
    const repository = ContentRepository.from([
      {
        ...TEST_PACK,
        passages: [
          taught(),
          {
            id: id<PassageId>('test-es:passage:700900'),
            pack: id('test-es'),
            kind: 'dialogue',
            title: 'Otra situación',
            level: 'a1',
            items: [id<ItemId>('test-es:item:001'), id<ItemId>('test-es:item:002')],
            speakers: ['Tú', 'Otra persona'],
          },
        ],
      },
    ]);
    const mission: MissionDefinition = {
      id: 'with-transfer',
      language: 'es',
      level: 'a1',
      order: 0,
      title: 'A mission with one transfer rung',
      goal: 'Use it somewhere new.',
      passage: '700001',
      transfers: [{ passage: '700900', support: 'guided', brief: 'Somewhere new.' }],
      capabilities: ['do-the-thing'],
      learnerSpeaker: 'Tú',
      spotlight: 0,
      estimatedMinutes: 4,
      scenarioPartner: 'someone',
    };

    const partial = missionStandings([mission], course, repository, everything(repository), {
      practised: new Set(),
      // The partner's line, not the learner's: no evidence of the learner
      // performing their own part.
      used: new Map([['with-transfer', new Set(['test-es:item:002'])]]),
    });
    const done = missionStandings([mission], course, repository, everything(repository), {
      practised: new Set(),
      used: new Map([['with-transfer', new Set(['test-es:item:001'])]]),
    });

    expect(partial[0]?.complete).toBe(false);
    expect(partial[0]?.transfersDone).toBe(0);
    expect(partial[0]?.transferPosition).toBe(1);
    expect(done[0]?.complete).toBe(true);
    expect(done[0]?.transfersDone).toBe(1);
    // The ladder is finished, so the current rung is the last one rather than
    // one past the end.
    expect(done[0]?.transferPosition).toBe(1);
    expect(done[0]?.transferTotal).toBe(1);
  });
});

describe('nextMissionStanding', () => {
  it('leads with the first unfinished mission', () => {
    const repository = testRepository();
    const standings = missionStandings(MISSIONS, course, repository, everything(repository), {
      practised: new Set(),
      used: new Map(),
    });

    expect(nextMissionStanding(standings)?.mission.id).toBe('morning-routine');
  });

  it('falls back to the last one when the course is finished', () => {
    // A finished course still has to offer something to open, and revisiting the
    // final transfer is a better answer than an empty screen.
    const finished = [
      { mission: { id: 'one' }, complete: true },
      { mission: { id: 'two' }, complete: true },
    ] as unknown as Parameters<typeof nextMissionStanding>[0];

    expect(nextMissionStanding(finished)?.mission.id).toBe('two');
  });

  it('has nothing to lead with when the course has no missions', () => {
    expect(nextMissionStanding([])).toBeUndefined();
  });
});

/** The fixture's own first passage, unchanged — the mission's taught exchange. */
function taught(): Passage {
  return {
    id: id<PassageId>('test-es:passage:700001'),
    pack: id('test-es'),
    kind: 'text',
    title: 'Un día de trabajo',
    level: 'a1',
    items: [id<ItemId>('test-es:item:001'), id<ItemId>('test-es:item:002')],
  };
}
