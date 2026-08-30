import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SpeechRecognitionProvider } from '../../src/audio';
import {
  loadCatalog,
  loadPack,
  loadTranslationUnit,
  type DatasetSource,
} from '../../src/data/loaders';
import { ContentRepository } from '../../src/domain/content';
import { MissionScreen } from '../../src/features/missions/MissionScreen';
import { missionPracticePath } from '../../src/features/missions/mission-url';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { StudyScreen } from '../../src/features/study/StudyScreen';
import { MISSIONS } from '../../src/app/missions';
import { renderWithServices, testServices } from '../fixtures/services';

const packRoot = resolve(process.cwd(), 'public/packs');
const packSource: DatasetSource = {
  name: packRoot,
  read: (path) => readFile(resolve(packRoot, path), 'utf8'),
};

/**
 * The shipped packs *and* their meanings, which are two fetches now.
 *
 * A translation set is its own addressed, independently versioned unit
 * (`docs/tasks/language-matrix.md` §3), so loading `catalog.packs` alone gives a
 * repository with every sentence and no gloss. This screen is where that shows
 * first and worst: a mission lists what it will teach in the *reference*
 * language, so without the unit it offers a learner "Saludar a alguien" as the
 * explanation of `Saludar a alguien`.
 */
async function shippedServices(speech?: SpeechRecognitionProvider) {
  const catalog = await loadCatalog(packSource);
  const loaded = await Promise.all(
    catalog.packs.map((entry) => loadPack(packSource, entry.manifest)),
  );
  const units = await Promise.all(
    (catalog.translations ?? []).map((entry) => loadTranslationUnit(packSource, entry.manifest)),
  );
  const repository = ContentRepository.from(loaded.map((result) => result.pack));
  for (const unit of units) repository.addTranslations(unit.translations);

  return testServices({ repository, ...(speech ? { speech } : {}) });
}

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

/**
 * The device's own Back — the one a screen cannot style away.
 *
 * A screen's Back button can be pointed anywhere, and this one is: it names the
 * missions list. The hardware button on a phone and the browser's arrow walk the
 * history stack regardless, so only this can catch a screen that quietly pushed
 * an entry per tap.
 */
function Rewind() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate(-1)}>
      Rewind
    </button>
  );
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
   * What the Understand stage opens on, which is the one thing about it a
   * learner cannot work around.
   *
   * It shipped the other way up: eleven capability rows, up to nine response
   * palettes and a variation lab all sat above the exchange, so a screen whose
   * own text said "first understand the connected example" put two phone screens
   * of English between a learner and the example. Nothing was broken, every
   * assertion passed, and the screen was unusable on a phone.
   *
   * Turning the column up the right way fixed its first line and left the rest:
   * three blocks in one scroll several screens long, with nothing at the top
   * saying the last two were down there. They are sections now, so the assertion
   * is what a bare mission link opens — the exchange, and only the exchange —
   * plus the fact that the other two are still announced rather than hidden.
   */
  it('opens on the exchange, and names the sections holding everything else', async () => {
    renderWithServices(missionRoutes(), {
      route: '/es/a1/mission/greet-and-respond/understand',
      services: await shippedServices(),
    });

    const exchange = await screen.findByRole('list', { name: /lines$/ });
    expect(screen.queryByRole('region', { name: 'Natural response palettes' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Variation lab' })).toBeNull();

    // The goal is still the first thing said, and it is still said in full.
    const goal = screen.getByRole('heading', { level: 2 });
    expect(goal.compareDocumentPosition(exchange)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    // Counted in the name, so a section a learner cannot see still says how much
    // it holds — the price of a switcher, paid back at the switcher.
    const switcher = screen.getByRole('navigation', { name: 'Understand sections' });
    expect(within(switcher).getByRole('link', { name: 'Dialogue' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(switcher).getByRole('link', { name: 'Responses 11' })).toBeInTheDocument();
    expect(within(switcher).getByRole('link', { name: 'Variations 3' })).toBeInTheDocument();
  });

  /*
   * A section is an address, which is what makes it survivable: a reload keeps
   * you in it, and "the response palettes for this mission" is a link somebody
   * can send. `dialogue` is the default and so is written by omission.
   */
  it('addresses each Understand section, and degrades a stale one to the exchange', async () => {
    const user = userEvent.setup();
    renderWithServices(missionRoutes(), {
      route: '/es/a1/mission/greet-and-respond/understand',
      services: await shippedServices(),
    });

    await screen.findByRole('list', { name: /lines$/ });
    await user.click(screen.getByRole('link', { name: 'Responses 11' }));

    expect(screen.getByTestId('where')).toHaveTextContent(
      '/es/a1/mission/greet-and-respond/understand?section=responses',
    );
    expect(screen.getByRole('region', { name: 'Natural response palettes' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /lines$/ })).toBeNull();

    await user.click(screen.getByRole('link', { name: 'Dialogue' }));
    expect(screen.getByTestId('where')).toHaveTextContent(
      '/es/a1/mission/greet-and-respond/understand',
    );
    expect(screen.getByRole('list', { name: /lines$/ })).toBeInTheDocument();
  });

  /*
   * The cost of the switcher, which must not be paid in history.
   *
   * `tests/features/back-navigation.test.tsx` holds the rule: Back may cost one
   * step, never two. A section is a rewrite of the screen you are already on, so
   * it replaces — otherwise every tab a learner tried on the way through is an
   * entry standing between them and the list they came from.
   */
  it('does not deepen the way out when a section is switched', async () => {
    const user = userEvent.setup();
    renderWithServices(
      <>
        <Routes>
          <Route path="/:language/:level/study" element={<StudyScreen />} />
          <Route path="/:language/:level/mission/:missionId/:stage" element={<MissionScreen />} />
          <Route path="*" element={null} />
        </Routes>
        <Rewind />
        <Where />
      </>,
      { route: '/es/a1/study?tab=missions', services: await shippedServices() },
    );

    await user.click(await screen.findByRole('link', { name: /Meet someone and keep talking/ }));
    expect(screen.getByTestId('where')).toHaveTextContent(
      '/es/a1/mission/greet-and-respond/understand',
    );

    await user.click(await screen.findByRole('link', { name: /^Responses/ }));
    await user.click(screen.getByRole('link', { name: /^Variations/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('section=variations');

    // One rewind, not three.
    await user.click(screen.getByRole('button', { name: 'Rewind' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/es/a1/study?tab=missions');
  });

  it('opens the exchange when the section in the link no longer exists', async () => {
    renderWithServices(missionRoutes(), {
      route: '/es/a1/mission/greet-and-respond/understand?section=nonsense',
      services: await shippedServices(),
    });

    expect(await screen.findByRole('list', { name: /lines$/ })).toBeInTheDocument();
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
      route: '/es/a1/mission/greet-and-respond/understand?section=responses',
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
      route: '/es/a1/mission/cafe-order/understand?section=responses',
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

    // Across to the lab through the switcher, which is the only way there now.
    await user.click(screen.getByRole('link', { name: /^Variations/ }));
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
   * be tapped — the dialogue could, which made the gap look like a bug in the
   * sheet rather than in the panel.
   */
  it('opens the word sheet from a palette response, not only from the dialogue', async () => {
    const user = userEvent.setup();
    renderWithServices(missionRoutes(), {
      route: '/es/a1/mission/greet-and-respond/understand?section=responses',
      services: await shippedServices(),
    });

    // Named by palette *and* phrase. Two palettes in this one section can offer
    // the same line, and the Dialogue section speaks several of them too — the
    // word sheet is shared across the stage, so the name has to be as well.
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

  /*
   * What a session is over, which the header used to leave unsaid.
   *
   * It was the preset's label and nothing else — "Quick practice", the same five
   * words over a mission, a set and the whole course. The preset is *how*; a
   * learner mid-session wants *what*, and the document title had the same gap,
   * so two sessions open in two tabs were indistinguishable.
   */
  it('names what a mission session is practising, and keeps the preset under it', async () => {
    renderWithServices(
      <Routes>
        <Route path="/:language/:level/session" element={<SessionScreen />} />
      </Routes>,
      {
        route:
          '/es/a1/session?preset=quick&size=all&passage=700033&mission=greet-and-respond&order=sequential',
        services: await shippedServices(),
      },
    );

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Meet someone and keep talking',
    );
    expect(screen.getByText('Quick practice')).toBeInTheDocument();
    expect(document.title).toBe('Meet someone and keep talking · Quick practice · Linguastein');
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
