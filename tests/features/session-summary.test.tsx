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

import { render, screen } from '@testing-library/react';
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
    const { container } = render(<SessionOutcomeSummary outcome={outcome()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the words that moved up', () => {
    render(
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
    expect(screen.getByText(/cerveza and agua/)).toBeInTheDocument();
    expect(screen.getByText(/words moved up/)).toBeInTheDocument();
  });

  it('names the words that slipped back rather than hiding them', () => {
    // The most useful thing the screen can say. Softening it wastes the finding.
    render(
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
    render(<SessionOutcomeSummary outcome={outcome({ advanced: many })} />);

    expect(screen.getByText(/\+2 more/)).toBeInTheDocument();
    expect(screen.queryByText(/seis/)).not.toBeInTheDocument();
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
    render(<SessionOutcomeSummary outcome={outcome({ nextDueInDays: days })} />);
    expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();
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
