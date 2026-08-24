import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SpeechRecognitionProvider } from '../../src/audio';
import { loadCatalog, loadPack, type DatasetSource } from '../../src/data/loaders';
import { ContentRepository } from '../../src/domain/content';
import { MissionScreen } from '../../src/features/missions/MissionScreen';
import { missionPracticePath } from '../../src/features/missions/mission-url';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { MISSIONS } from '../../src/app/missions';
import { renderWithServices, testServices } from '../fixtures/services';

const packRoot = resolve(process.cwd(), 'public/packs');
const packSource: DatasetSource = {
  name: packRoot,
  read: (path) => readFile(resolve(packRoot, path), 'utf8'),
};

async function shippedServices(speech?: SpeechRecognitionProvider) {
  const catalog = await loadCatalog(packSource);
  const loaded = await Promise.all(
    catalog.packs.map((entry) => loadPack(packSource, entry.manifest)),
  );
  return testServices({
    repository: ContentRepository.from(loaded.map((result) => result.pack)),
    ...(speech ? { speech } : {}),
  });
}

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

function missionRoutes() {
  return (
    <>
      <Routes>
        <Route path="/:language/:level/mission/:missionId/:stage" element={<MissionScreen />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </>
  );
}

describe('MissionScreen', () => {
  it('puts communicative capabilities in the shareable practice URL', () => {
    const cafe = MISSIONS.find((mission) => mission.id === 'cafe-order')!;
    const path = missionPracticePath({ language: 'es', level: 'a1' }, cafe);

    expect(path).toBe(
      '/es/a1/session?preset=quick&size=all&passage=700009&mission=cafe-order&skill=order-food-drink%2Chandle-add-on%2Cask-understand-price%2Cclose-service-exchange&order=sequential',
    );
  });

  it('turns the source passage into an understandable first stage', async () => {
    const user = userEvent.setup();
    renderWithServices(missionRoutes(), {
      route: '/es/all/mission/morning-routine/understand',
    });

    expect(
      await screen.findByRole('heading', { name: 'Describe your morning' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Mission journey' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'About “Tengo” in “Tengo que trabajar.”' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start practice' }));
    expect(screen.getByTestId('where')).toHaveTextContent('passage=700001');
    expect(screen.getByTestId('where')).toHaveTextContent('mission=morning-routine');
    expect(screen.getByTestId('where')).toHaveTextContent('order=sequential');
  });

  /*
   * The order of the Understand stage, which is the one thing about it a learner
   * cannot work around.
   *
   * It shipped the other way up: eleven capability rows, up to nine response
   * palettes and a variation lab all sat above the exchange, so a screen whose
   * own text said "first understand the connected example" put two phone screens
   * of English between a learner and the example. Nothing was broken, every
   * assertion passed, and the screen was unusable on a phone.
   *
   * Document order is the assertion because document order is the bug — jsdom has
   * no layout, but "the dialogue comes before the panels about it" is a fact
   * about the tree rather than about pixels.
   */
  it('puts the exchange above everything written about it', async () => {
    renderWithServices(missionRoutes(), {
      route: '/es/a1/mission/greet-and-respond/understand',
      services: await shippedServices(),
    });

    const exchange = await screen.findByRole('list', { name: /lines$/ });
    const palettes = screen.getByRole('region', { name: 'Natural response palettes' });
    const lab = screen.getByRole('region', { name: 'Variation lab' });

    expect(exchange.compareDocumentPosition(palettes)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(exchange.compareDocumentPosition(lab)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    // The goal is still the first thing said, and it is still said in full.
    const goal = screen.getByRole('heading', { level: 2 });
    expect(goal.compareDocumentPosition(exchange)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('offers what the mission will teach without spending the screen on it', async () => {
    const user = userEvent.setup();
    renderWithServices(missionRoutes(), {
      route: '/es/a1/mission/greet-and-respond/understand',
      services: await shippedServices(),
    });

    // Eleven abilities, as one control that says so. The count is in the name
    // rather than only beside it: a control that reads "What you'll be able to
    // do" and hides an unknown amount is a control nobody opens twice.
    const opener = await screen.findByRole('button', {
      name: 'What you\u2019ll be able to do: 11 abilities',
    });
    expect(opener).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Greet someone')).not.toBeInTheDocument();

    await user.click(opener);

    const sheet = await screen.findByRole('dialog', { name: 'What you\u2019ll be able to do' });
    expect(sheet).toHaveTextContent('Greet someone');
    // Named once. The sheet's own heading is the list's name, so the list must
    // not repeat it — two identical headings is what makes an agent guess.
    expect(within(sheet).queryByRole('heading', { level: 3 })).not.toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /*
   * The dialogue, as a dialogue.
   *
   * It was drawn as a list: every turn a full-width slab, evenly spaced, the
   * speaker's name printed above each one. That is a transcript in the
   * stenographic sense, and following who was talking meant *reading* the names —
   * the one thing a conversation should cost nothing to see.
   *
   * What is asserted is the structure the layout rests on, because jsdom has no
   * layout: which side each voice takes, where a run of turns begins, and that
   * the hue belongs to the speaker rather than to the row.
   */
  it('casts the learner on their own side of the exchange', async () => {
    renderWithServices(missionRoutes(), {
      route: '/es/a1/mission/greet-and-respond/understand',
      services: await shippedServices(),
    });

    const turns = [...(await screen.findByRole('list', { name: /lines$/ })).querySelectorAll('li')];
    expect(turns.length).toBeGreaterThan(2);

    // `greet-and-respond` casts the learner as Luis. Their turns take the end
    // side and *everyone else* takes the start — which is how a conversation with
    // three people in it has to work, and the reason this is not simple
    // alternation.
    const sides = new Map<string, Set<string>>();
    for (const turn of turns) {
      const speaker = turn.dataset['speaker']!;
      sides.set(speaker, (sides.get(speaker) ?? new Set()).add(turn.dataset['side']!));
    }
    expect(sides.get('Luis')).toEqual(new Set(['end']));
    expect(sides.size).toBeGreaterThan(1);
    for (const [speaker, taken] of sides) {
      expect(taken.size, `${speaker} takes one side`).toBe(1);
      if (speaker !== 'Luis') expect(taken).toEqual(new Set(['start']));
    }
  });

  it('marks a run of turns by one speaker, and still names every one of them', async () => {
    renderWithServices(missionRoutes(), {
      route: '/es/a1/mission/greet-and-respond/understand',
      services: await shippedServices(),
    });

    const turns = [...(await screen.findByRole('list', { name: /lines$/ })).querySelectorAll('li')];
    const speakers = turns.map((turn) => turn.dataset['speaker']);

    turns.forEach((turn, index) => {
      const startsRun = speakers[index] !== speakers[index - 1];
      expect(turn.dataset['run'], `turn ${index + 1}`).toBe(startsRun ? 'start' : 'continued');

      /*
       * The name is in the DOM on every turn, whether or not it is drawn. A
       * screen reader reads turns one at a time and has no column to see the
       * grouping in, so a name printed once would be a name it hears once — and
       * the rest of the exchange arrives as unattributed Spanish. Same trade as
       * the visual layout, made the other way round for a reader who cannot use
       * the layout.
       */
      const name = turn.firstElementChild!;
      expect(name.textContent).toBe(speakers[index]);
      expect(name.className.includes('visually-hidden')).toBe(!startsRun);
    });
  });

  it('gives each speaker a hue of their own, and keeps it', async () => {
    renderWithServices(missionRoutes(), {
      route: '/es/a1/mission/greet-and-respond/understand',
      services: await shippedServices(),
    });

    const turns = [...(await screen.findByRole('list', { name: /lines$/ })).querySelectorAll('li')];
    const hues = new Map<string, Set<string>>();
    for (const turn of turns) {
      const speaker = turn.dataset['speaker']!;
      /*
       * The last child is the bubble's row, and the bubble is what carries the
       * hue. Queried that way rather than as `[data-kind]` anywhere in the turn,
       * because the printed name carries the same hue — a loose query would pass
       * off the label and never notice the turn itself losing its colour.
       */
      const row = turn.lastElementChild!;
      const hue = row.firstElementChild!.getAttribute('data-kind')!;
      hues.set(speaker, (hues.get(speaker) ?? new Set()).add(hue));
    }

    for (const [speaker, taken] of hues) expect(taken.size, speaker).toBe(1);
    const distinct = new Set([...hues.values()].map((taken) => [...taken][0]));
    expect(distinct.size).toBe(hues.size);
  });

  it('introduces a small response palette before revealing its full range', async () => {
    const user = userEvent.setup();
    renderWithServices(missionRoutes(), {
      route: '/es/a1/mission/greet-and-respond/understand',
      services: await shippedServices(),
    });

    await waitFor(() => {
      expect(screen.getByText('More than “I’m fine”')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: 'Listen to response “Estoy bien, gracias.”' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Listen to response “Regular.”' }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'More than “I’m fine”: show 7 more responses' }),
    );
    expect(
      screen.getByRole('button', { name: 'Listen to response “Regular.”' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Things could be better')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'More than “I’m fine”: show fewer responses' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('uses the same progressive palette pattern in another mission', async () => {
    const user = userEvent.setup();
    renderWithServices(missionRoutes(), {
      route: '/es/a1/mission/cafe-order/understand',
      services: await shippedServices(),
    });

    await waitFor(() => {
      expect(screen.getByText('Build the order you actually want')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: 'Listen to response “Un café solo, por favor.”' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Listen to response “De momento, solo un café.”' }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Build the order you actually want: show 5 more responses',
      }),
    );
    expect(
      screen.getByRole('button', { name: 'Listen to response “De momento, solo un café.”' }),
    ).toBeInTheDocument();

    expect(screen.getByRole('region', { name: 'Variation lab' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('How to begin'), 'para-mi');
    await user.selectOptions(screen.getByLabelText('Drink'), 'agua');
    await user.selectOptions(screen.getByLabelText('Finish'), 'plain');
    expect(screen.getByText('Para mí, un agua.')).toBeInTheDocument();
    expect(screen.getByText('For me, a water.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Practise from meaning' }));
    expect(screen.queryByText('Para mí, un agua.')).not.toBeInTheDocument();
    expect(screen.getByText(/Spanish hidden/)).toHaveAttribute('role', 'status');
    await user.click(screen.getByRole('button', { name: 'Show Spanish' }));
    expect(screen.getByText('Para mí, un agua.')).toBeInTheDocument();
  });

  /*
   * The palettes carry most of the language a mission teaches, and for a long
   * while they were the one place on the screen where an unknown word could not
   * be tapped — the dialogue below them could, which made the gap look like a
   * bug in the sheet rather than in the panel.
   */
  it('opens the word sheet from a palette response, not only from the dialogue', async () => {
    const user = userEvent.setup();
    renderWithServices(missionRoutes(), {
      route: '/es/a1/mission/greet-and-respond/understand',
      services: await shippedServices(),
    });

    // Named by palette *and* phrase: this very line is also spoken in the
    // dialogue below, so the phrase alone would name two different controls.
    const word = await screen.findByRole('button', {
      name: 'About “Grecia” in “Where you are from — and where you live · Soy de Grecia.”',
    });
    await user.click(word);

    expect(await screen.findByRole('dialog', { name: 'About Grecia' })).toBeInTheDocument();
    // The very node that was tapped, still in the document: the stage used to be
    // declared inside the screen, so any background query landing mid-tap
    // replaced the whole subtree and the tap fell on a detached button.
    expect(document.body.contains(word)).toBe(true);
    expect(word).toHaveAttribute('aria-expanded', 'true');
  });

  it('lets the learner ask about a word in what the other person just said', async () => {
    const user = userEvent.setup();
    renderWithServices(missionRoutes(), {
      route: '/es/a1/mission/greet-and-respond/use',
      services: await shippedServices(),
    });

    // Ana's opening line. One phrase on screen, so the name stays short.
    await user.click(await screen.findByRole('button', { name: 'About “Hola”' }));
    expect(await screen.findByRole('dialog', { name: 'About Hola' })).toBeInTheDocument();
  });

  it('accepts a different natural response during mission transfer', async () => {
    const speech: SpeechRecognitionProvider = {
      id: 'palette-test',
      isAvailable: () => true,
      supportsLanguage: () => true,
      stop: () => {},
      listen: () => Promise.resolve({ transcript: 'más o menos', confidence: 0.95 }),
    };
    const services = await shippedServices(speech);
    const user = userEvent.setup();
    renderWithServices(missionRoutes(), {
      route: '/es/a1/mission/greet-and-respond/use',
      services,
    });

    await user.click(await screen.findByRole('button', { name: 'Reply' }));
    await user.click(screen.getByRole('button', { name: 'Reveal the line' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));

    expect(await screen.findByText(/11 natural responses are accepted/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check my pronunciation' }));
    expect(await screen.findByText(/That matched/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Record result and continue/ }));

    const attempts = await services.storage.attempts.recent(5);
    expect(attempts[0]).toMatchObject({
      itemId: expect.stringMatching(/:item:000736$/),
      grade: 'good',
      correct: true,
    });
  });

  it('narrows accepted palette responses to the current register', async () => {
    const services = await shippedServices();
    const transferOne = [
      '000713',
      '000736',
      '000715',
      '000996',
      '000998',
      '001000',
      '001061',
      '001063',
      '000717',
    ];
    for (const localId of transferOne) {
      const item = services.repository.itemByLocalId(localId)!;
      await services.storage.attempts.append({
        id: `completed-${localId}`,
        itemId: item.id,
        exerciseKind: 'think-say',
        grade: 'good',
        correct: true,
        at: 1_700_000_000_000,
        sessionId: 'mission:greet-and-respond:use:700034:test',
      });
    }
    const user = userEvent.setup();
    renderWithServices(missionRoutes(), {
      route: '/es/a1/mission/greet-and-respond/use',
      services,
    });

    expect(await screen.findByText('Transfer 2 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    await user.click(screen.getByRole('button', { name: 'Reveal the line' }));
    await user.click(screen.getByRole('button', { name: 'Got it' }));

    expect(await screen.findByText(/8 natural responses are accepted/)).toBeInTheDocument();
  });

  it('runs the Use stage as recall before reveal and reaches completion', async () => {
    const user = userEvent.setup();
    const { services } = renderWithServices(missionRoutes(), {
      route: '/es/all/mission/morning-routine/use',
    });

    await screen.findByText('I have to work.');
    expect(screen.getByText('I have to work.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'About “Tengo”' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reveal the line' }));
    expect(screen.getByRole('button', { name: 'About “Tengo”' })).toBeInTheDocument();
    expect(screen.queryByText('Transfer 1 of 1 complete')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));

    await user.click(screen.getByRole('button', { name: 'Reveal the line' }));
    await user.click(screen.getByRole('button', { name: 'Not yet' }));

    expect(await screen.findByText('Transfer 1 of 1 complete')).toBeInTheDocument();
    expect(
      screen.getByText('2 transfer attempts recorded: 1 solid, 0 partial, 1 not yet.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish mission' })).toBeInTheDocument();
    expect(await services.storage.attempts.recent(10)).toHaveLength(2);
    const progress = await services.storage.progress.all();
    expect(progress.find((entry) => entry.itemId.endsWith(':item:001'))?.attempts).toBe(1);
    expect(progress.find((entry) => entry.itemId.endsWith(':item:002'))?.incorrect).toBe(1);
  });

  it('turns a matching speech check into a recorded transfer grade', async () => {
    const speech: SpeechRecognitionProvider = {
      id: 'mission-test',
      isAvailable: () => true,
      supportsLanguage: () => true,
      stop: () => {},
      listen: () => Promise.resolve({ transcript: 'tengo que trabajar', confidence: 0.95 }),
    };
    const services = testServices({ speech });
    const user = userEvent.setup();
    renderWithServices(missionRoutes(), {
      route: '/es/all/mission/morning-routine/use',
      services,
    });

    await user.click(await screen.findByRole('button', { name: 'Check my pronunciation' }));
    expect(await screen.findByText(/That matched/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Record result and continue/ }));

    expect(await screen.findByText('I have to go.')).toBeInTheDocument();
    const [attempt] = await services.storage.attempts.recent(1);
    expect(attempt).toMatchObject({ grade: 'good', correct: true, exerciseKind: 'think-say' });
    expect(attempt?.sessionId).toMatch(/^mission:morning-routine:use:700001:/);
  });

  it('continues a finished tracked session into the Use stage', async () => {
    const user = userEvent.setup();
    renderWithServices(
      <>
        <SessionScreen />
        <Where />
      </>,
      {
        route: '/session?preset=speaking&size=items:1&order=sequential&mission=morning-routine',
      },
    );

    await screen.findByText('1/1');
    await user.click(screen.getByRole('button', { name: 'Reveal' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));
    await user.click(await screen.findByRole('button', { name: /Continue to Use/ }));

    expect(screen.getByTestId('where')).toHaveTextContent('/es/all/mission/morning-routine/use');
  });
});
