/**
 * Answer feedback has to be impossible to miss, and honest about what happened.
 *
 * The verdict used to be a line of small print under the choices, and every
 * distractor turned red whether or not it was the one tapped. It is now a band
 * in the result colour, and only the chosen wrong answer is marked.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import buttonStyles from '../../src/components/Button.module.css';
import styles from '../../src/features/practice/Practice.module.css';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { renderWithServices } from '../fixtures/services';
import { css } from '../fixtures/styles';

const CHOICE = /beer|water|bread|coffee/;

describe('answer feedback', () => {
  it('states the verdict in a banner of its own', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, { route: '/session?preset=vocabulary&size=items:1' });

    const choices = await screen.findAllByRole('button', { name: CHOICE });
    await user.click(choices[0]!);

    const verdict = await screen.findByRole('status');
    expect(verdict).toHaveClass(css(styles, 'verdict'));

    // Whichever way the tapped choice went, the banner says so in its own
    // colour — and a wrong answer names the right one.
    if (verdict.textContent?.includes('¡Correcto!')) {
      expect(verdict).toHaveClass(css(styles, 'verdictCorrect'));
    } else {
      expect(verdict).toHaveClass(css(styles, 'verdictIncorrect'));
      expect(verdict.textContent).toMatch(/Answer: \w+/);
    }
  });

  it('marks the right answer, and a wrong one only where it was tapped', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, { route: '/session?preset=vocabulary&size=items:1' });

    const choices = await screen.findAllByRole('button', { name: CHOICE });
    await user.click(choices[0]!);
    await screen.findByRole('status');

    const marked = (variant: string) =>
      choices.filter((choice) => choice.classList.contains(variant));

    expect(marked(css(buttonStyles, 'correct'))).toHaveLength(1);
    // The distractors nobody chose stay neutral rather than all turning red.
    expect(marked(css(buttonStyles, 'incorrect')).every((choice) => choice === choices[0])).toBe(
      true,
    );
    expect(marked(css(buttonStyles, 'incorrect')).length).toBeLessThanOrEqual(1);
  });
});
