/**
 * What a finished session says it achieved.
 *
 * The old screen printed a bare fraction, which tells a learner nothing they can
 * act on. These tests hold the three rules that make the replacement honest
 * rather than merely warmer:
 *
 * - it stays quiet when there is nothing to report, rather than manufacturing an
 *   achievement out of a normal session;
 * - it names words that slipped back instead of only the ones that improved,
 *   because the slip is the more useful half;
 * - a study session gets no summary at all, since it records nothing and a panel
 *   implying otherwise would contradict the line printed above it.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { SessionOutcomeSummary } from '../../src/features/practice/SessionOutcomeSummary';
import type { SessionOutcome } from '../../src/features/practice/useSessionRunner';
import type { ItemId } from '../../src/domain/content';
import { id } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

const change = (
  local: string,
  text: string,
  from: 'new' | 'learning' | 'review',
  to: typeof from,
) => ({
  itemId: id<ItemId>(`test-es:item:${local}`),
  text,
  from,
  to,
});

const outcome = (partial: Partial<SessionOutcome> = {}): SessionOutcome => ({
  advanced: [],
  lapsed: [],
  ...partial,
});

describe('the outcome summary', () => {
  it('renders nothing when the session moved nothing', () => {
    // A session where every item held its stage is a normal session. An empty
    // panel announcing that reads as a failure report.
    const { container } = renderWithServices(<SessionOutcomeSummary outcome={outcome()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the words that moved up', () => {
    renderWithServices(
      <SessionOutcomeSummary
        outcome={outcome({
          advanced: [
            change('004', 'cerveza', 'new', 'learning'),
            change('005', 'agua', 'new', 'learning'),
          ],
        })}
      />,
    );

    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(screen.getByText(/words moved up/)).toBeInTheDocument();
    // One row each, not `cerveza and agua` in a comma list. Every entry is itself
    // a sentence with its own commas, so joining them separated nothing — and a
    // joined string is a string, which is the reason no word in it could be tapped.
    expect(screen.getByText('cerveza')).toBeInTheDocument();
    expect(screen.getByText('agua')).toBeInTheDocument();
  });

  it('names the words that slipped back rather than hiding them', () => {
    // The most useful thing the screen can say. Softening it wastes the finding.
    renderWithServices(
      <SessionOutcomeSummary
        outcome={outcome({ lapsed: [change('006', 'pan', 'review', 'learning')] })}
      />,
    );

    expect(screen.getByText(/to see again sooner/)).toBeInTheDocument();
    expect(screen.getByText(/pan/)).toBeInTheDocument();
  });

  /**
   * Through the providers rather than bare, because the language is no longer
   * typed into the markup: it comes from the course, so that a German pack is
   * marked as German rather than read out with Spanish pronunciation. A summary
   * rendered with no course to ask carries no `lang` at all, which is the
   * honest answer and not this assertion.
   */
  it('marks the Spanish as Spanish, so it is not read out in English', () => {
    const { container } = renderWithServices(
      <SessionOutcomeSummary
        outcome={outcome({ advanced: [change('004', 'cerveza', 'new', 'learning')] })}
      />,
      { route: '/es/a1' },
    );
    expect(container.querySelector('[lang="es"]')?.textContent).toBe('cerveza');
  });

  it('counts the tail instead of listing every word', () => {
    const many = ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis'].map((text, index) =>
      change(`00${index}`, text, 'new', 'learning'),
    );
    renderWithServices(<SessionOutcomeSummary outcome={outcome({ advanced: many })} />);

    expect(screen.getByText(/\+2 more/)).toBeInTheDocument();
    expect(screen.queryByText(/seis/)).not.toBeInTheDocument();
  });

  /**
   * The gap roadmap item 8 recorded: the sentences here were a joined string, so
   * the one screen that has just said a word slipped back was the one place a
   * learner could not ask which word was the problem.
   */
  it('lets a word be tapped, on the screen that just said it slipped', async () => {
    const user = userEvent.setup();
    renderWithServices(
      <SessionOutcomeSummary
        outcome={outcome({ lapsed: [change('001', 'Tengo que trabajar.', 'review', 'learning')] })}
      />,
      { route: '/es/a1' },
    );

    // Anchored: every token's accessible name names the whole sentence too
    // (`contextLabel`), so a loose match finds each word in the row.
    await user.click(screen.getByRole('button', { name: /^About .Tengo./ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('still names an item whose pack has gone, untappable rather than missing', () => {
    // A change carries the text it had at the time, so the row survives a pack
    // being removed mid-session and simply stops being tappable.
    renderWithServices(
      <SessionOutcomeSummary
        outcome={outcome({ advanced: [change('nope', 'una frase', 'new', 'learning')] })}
      />,
    );

    expect(screen.getByText('una frase')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /frase/ })).not.toBeInTheDocument();
  });

  it.each([
    [0, 'later today'],
    [1, 'tomorrow'],
    [4, 'in 4 days'],
    [10, 'in about a week'],
    [30, 'in about 4 weeks'],
    [120, 'in about 4 months'],
  ])('describes a %i-day interval as "%s"', (days, expected) => {
    // Coarse on purpose: an interval given to the hour invites treating the
    // schedule as a deadline, which is the opposite of how spacing works.
    renderWithServices(<SessionOutcomeSummary outcome={outcome({ nextDueInDays: days })} />);
    expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();
  });
});

/**
 * The last of roadmap item 2. `?order=` has been carried since sessions existed
 * and three screens set it when they build a link, but a learner already inside a
 * set had no way to change it.
 */
describe('the card order', () => {
  it('is offered in a study session, with the current one marked', async () => {
    renderWithServices(<SessionScreen />, {
      services: testServices(),
      route: '/session?preset=flashcards&size=items:2&order=random',
    });

    const shuffled = await screen.findByRole('link', { name: 'Shuffled' });
    expect(shuffled).toHaveAttribute('aria-current', 'true');
    // An address, so the state is `aria-current` and not `aria-pressed` — a
    // pressed link is a category error a screen reader reads out as one.
    expect(shuffled).not.toHaveAttribute('aria-pressed');
    expect(screen.getByRole('link', { name: 'In order' })).not.toHaveAttribute('aria-current');
  });

  it('keeps every other facet of the session it switches', async () => {
    renderWithServices(<SessionScreen />, {
      services: testServices(),
      route: '/session?preset=flashcards&size=items:2&order=random&level=a1',
    });

    const href = (await screen.findByRole('link', { name: 'In order' })).getAttribute('href') ?? '';
    expect(href).toContain('order=sequential');
    expect(href).toContain('preset=flashcards');
    expect(href).toContain('level=a1');
  });

  it('is absent from a tracked session, whose order the scheduler owns', async () => {
    renderWithServices(<SessionScreen />, {
      services: testServices(),
      route: '/session?preset=quick&size=items:2',
    });

    await screen.findByRole('button', { name: /Skip/ });
    expect(screen.queryByRole('navigation', { name: 'Card order' })).not.toBeInTheDocument();
  });
});

describe('a finished session', () => {
  it('reports what improved after a practice session', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, {
      services: testServices(),
      // `speaking` is a practice preset built on think-say, so one self-rated
      // answer is enough to move an unseen item off `new`.
      route: '/session?preset=speaking&size=items:1&order=sequential',
    });

    await screen.findByText('1/1');
    await user.click(screen.getByRole('button', { name: 'Reveal' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));

    expect(await screen.findByText(/Progress saved/)).toBeInTheDocument();
    // The earned half: a word actually changed stage, and the screen says which.
    expect(screen.getByText(/word moved up/)).toBeInTheDocument();
    expect(screen.getByText(/Back for review/)).toBeInTheDocument();
  });

  it('says nothing about progress after a study session', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, {
      services: testServices(),
      route: '/session?preset=flashcards&size=items:1&order=sequential',
    });

    await screen.findByText('1/1');
    await user.click(screen.getByRole('button', { name: 'Reveal' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));

    expect(await screen.findByText(/nothing was recorded/)).toBeInTheDocument();
    // No summary panel: study mode records nothing, so it has nothing to claim.
    expect(screen.queryByText(/moved up/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Back for review/)).not.toBeInTheDocument();
  });
});
