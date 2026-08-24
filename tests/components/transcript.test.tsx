/**
 * A conversation, as a shape rather than as a list.
 *
 * The two screens that show a passage assert this through their own data
 * (`tests/features/reading.test.tsx`, `tests/features/missions.test.tsx`), and
 * both of the shipped dialogues they use happen to alternate strictly — so the
 * branches that matter most here are the ones real data does not reach: a run of
 * consecutive turns by one speaker, a third voice, and narration with nobody
 * behind it. Those are hand-built below.
 *
 * `Transcript` needs no services and no router, so it is rendered directly.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Transcript, type TranscriptLine } from '../../src/components/Transcript';
import type { ItemId, LearningItem } from '../../src/domain/content';
import { id, TEST_PACK_ID } from '../fixtures/pack';

let counter = 0;
function line(text: string, speaker?: string): TranscriptLine {
  counter += 1;
  const item: LearningItem = {
    id: id<ItemId>(`test-es:item:9${String(counter).padStart(5, '0')}`),
    pack: TEST_PACK_ID,
    type: 'sentence',
    text,
    level: 'a1',
  };
  return { item, ...(speaker ? { speaker } : {}) };
}

function turns(): HTMLElement[] {
  return [...screen.getByRole('list').children] as HTMLElement[];
}

/**
 * What a turn is drawn as, without asserting on generated class names.
 *
 * Read off `data-speaker` and the turn's first child rather than "the first `p`
 * in here": the line's own text is a `p` as well, so that query means the speaker
 * on a turn that has one and the Spanish on a turn that does not.
 */
function shape(turn: HTMLElement) {
  const speaker = turn.dataset['speaker'];
  const name = speaker === undefined ? null : turn.firstElementChild!;
  return {
    speaker: speaker ?? null,
    named: name !== null && !name.className.includes('visually-hidden'),
    side: turn.dataset['side'],
    run: turn.dataset['run'],
    hue: turn.lastElementChild!.firstElementChild!.getAttribute('data-kind'),
  };
}

describe('a dialogue', () => {
  it('groups a run of turns by one speaker and names it once', () => {
    render(
      <Transcript
        label="A run, 4 lines"
        lines={[
          line('¿Tiene una habitación?', 'Cliente'),
          line('Para dos noches.', 'Cliente'),
          line('¿El desayuno está incluido?', 'Cliente'),
          line('Sí, de siete a diez.', 'Recepcionista'),
        ]}
        onSelectWord={() => {}}
        selectedTokens={() => []}
        onListen={() => {}}
      />,
    );

    const [first, second, third, fourth] = turns().map(shape);

    // The run opens once and continues twice. The name is drawn on the opening
    // turn only, so three turns read as one block of speech rather than as three
    // rows each labelled `Cliente`.
    expect(first).toMatchObject({ speaker: 'Cliente', named: true, run: 'start' });
    expect(second).toMatchObject({ speaker: 'Cliente', named: false, run: 'continued' });
    expect(third).toMatchObject({ speaker: 'Cliente', named: false, run: 'continued' });
    expect(fourth).toMatchObject({ speaker: 'Recepcionista', named: true, run: 'start' });

    /*
     * And every one of them still carries the name. A screen reader reads turns
     * one at a time with no column to see the grouping in, so a name drawn once
     * would be a name it hears once — and turns two and three would arrive as
     * unattributed Spanish.
     */
    expect(screen.getAllByText('Cliente')).toHaveLength(3);
  });

  it('keeps everyone but the learner on the other side, however many there are', () => {
    render(
      <Transcript
        label="Three voices, 4 lines"
        lines={[
          line('Buenas tardes.', 'Camarero'),
          line('Hola.', 'Cliente'),
          line('¿Y para usted?', 'Camarero'),
          line('Un café, por favor.', 'Acompañante'),
        ]}
        self="Cliente"
        onSelectWord={() => {}}
        selectedTokens={() => []}
        onListen={() => {}}
      />,
    );

    /*
     * The rule that alternation cannot express. With a third voice in the room,
     * "take turns left and right" puts one of the other two on the learner's own
     * side and quietly claims they are the learner; `self` against everyone else
     * stays true whatever the cast size.
     */
    const sides = turns().map(shape);
    expect(sides.map((turn) => turn.side)).toEqual(['start', 'end', 'start', 'start']);

    // Told apart by hue instead, which is what the start side has for the job.
    const others = new Set(sides.filter((turn) => turn.side === 'start').map((turn) => turn.hue));
    expect(others.size).toBe(2);
  });

  it('alternates by who speaks first when nobody is cast', () => {
    render(
      <Transcript
        label="Nobody cast, 3 lines"
        lines={[line('Hola.', 'Ana'), line('Hola.', 'Luis'), line('¿Qué tal?', 'Ana')]}
        onSelectWord={() => {}}
        selectedTokens={() => []}
        onListen={() => {}}
      />,
    );

    // Whoever opens is on the start side, in every passage, whatever order the
    // pack's `speakers` array happens to hold.
    expect(turns().map((turn) => shape(turn).side)).toEqual(['start', 'end', 'start']);
  });

  it('breaks a run with unattributed narration rather than joining across it', () => {
    render(
      <Transcript
        label="With narration, 3 lines"
        lines={[line('Hola.', 'Ana'), line('Ana se sienta.'), line('¿Qué tal?', 'Ana')]}
        onSelectWord={() => {}}
        selectedTokens={() => []}
        onListen={() => {}}
      />,
    );

    const rows = turns();
    expect(rows[0]!.dataset['run']).toBe('start');
    // The narration is a turn with no speaker: no name, no hue, and it ends Ana's
    // run — so her next line opens a new one rather than continuing across it.
    expect(rows[1]!.dataset['speaker']).toBeUndefined();
    expect(rows[1]!.lastElementChild!.firstElementChild).not.toHaveAttribute('data-kind');
    expect(rows[2]!.dataset['run']).toBe('start');
  });

  it('names each play control by its line, so twenty of them stay pickable', () => {
    render(
      <Transcript
        label="Two lines"
        lines={[line('Hola.', 'Ana'), line('¿Qué tal?', 'Luis')]}
        onSelectWord={() => {}}
        selectedTokens={() => []}
        onListen={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Listen to “Hola.”' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Listen to “¿Qué tal?”' })).toBeInTheDocument();
  });
});

describe('a text', () => {
  it('is prose, with no sides and no voices', () => {
    render(
      <Transcript
        label="Una mañana normal, 2 sentences"
        lines={[line('Me levanto a las siete.'), line('Desayuno en casa.')]}
        onSelectWord={() => {}}
        selectedTokens={() => []}
        onListen={() => {}}
      />,
    );

    // The branch exists because a passage is two kinds of thing, and it is easy
    // to lose: both shapes render an `ol` of `li` with a tokenised line in each,
    // so drawing every passage as bubbles would break nothing a text query sees.
    for (const row of turns()) {
      expect(row.dataset['side']).toBeUndefined();
      expect(row.dataset['run']).toBeUndefined();
    }
  });
});
