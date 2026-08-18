import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { markUpdateReady, resetUpdateState } from '../../src/app/updates';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import { ProgressScreen } from '../../src/features/progress/ProgressScreen';
import { PassageScreen } from '../../src/features/read/PassageScreen';
import { ReadScreen } from '../../src/features/read/ReadScreen';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';
import { renderWithServices } from '../fixtures/services';
import { expectNoViolations } from './axe';

describe('accessibility', () => {
  it('home screen has no WCAG violations', async () => {
    const { container } = renderWithServices(<HomeScreen />);
    await screen.findByRole('heading', { level: 1 });
    await expectNoViolations(container);
  });

  it('settings screen has no WCAG violations', async () => {
    const { container } = renderWithServices(<SettingsScreen />, { route: '/settings' });
    await screen.findByRole('heading', { level: 1 });
    await expectNoViolations(container);
  });

  it('browse screen has no WCAG violations', async () => {
    const { container } = renderWithServices(<BrowseScreen />, { route: '/browse' });
    await screen.findByRole('searchbox');
    await expectNoViolations(container);
  });

  it('the update banner has no WCAG violations', async () => {
    // A new surface with its own colours, so it is held to contrast and naming
    // like any screen. It renders nothing until the worker reports a build.
    const { container } = renderWithServices(<HomeScreen />);
    await screen.findByRole('heading', { level: 1 });

    act(() => markUpdateReady());
    await screen.findByRole('button', { name: 'Reload' });

    await expectNoViolations(container);
    resetUpdateState();
  });

  it('reading list has no WCAG violations', async () => {
    const { container } = renderWithServices(<ReadScreen />, { route: '/read' });
    await screen.findByRole('heading', { level: 1 });
    await expectNoViolations(container);
  });

  it('a passage has no WCAG violations', async () => {
    const { container } = renderWithServices(
      <Routes>
        <Route path="/read/:id" element={<PassageScreen />} />
      </Routes>,
      { route: '/read/700002' },
    );
    await screen.findByRole('heading', { level: 1 });
    await expectNoViolations(container);
  });

  it('progress screen has no WCAG violations', async () => {
    const { container } = renderWithServices(<ProgressScreen />, { route: '/progress' });
    await screen.findByRole('heading', { level: 1 });
    await expectNoViolations(container);
  });

  it('practice card has no WCAG violations', async () => {
    const { container } = renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=items:2',
    });
    await screen.findByRole('button', { name: 'Reveal' });
    await expectNoViolations(container);
  });

  it('word panel has no WCAG violations', async () => {
    const user = userEvent.setup();
    const { container } = renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=items:1',
    });

    await user.click(await screen.findByRole('button', { name: 'About “Tengo”' }));
    await screen.findByRole('dialog');
    await expectNoViolations(container);
  });

  it('answered multiple choice has no WCAG violations', async () => {
    const user = userEvent.setup();
    const { container } = renderWithServices(<SessionScreen />, {
      route: '/session?preset=vocabulary&size=items:1',
    });

    const choices = await screen.findAllByRole('button', { name: /beer|water|bread|coffee/ });
    await user.click(choices[0]!);
    await screen.findByRole('button', { name: 'Continue' });
    await expectNoViolations(container);
  });
});

describe('keyboard and screen-reader behaviour', () => {
  it('gives every screen exactly one level-1 heading', async () => {
    renderWithServices(<HomeScreen />);
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1));
  });

  it('reports session position as a progress bar', async () => {
    renderWithServices(<SessionScreen />, { route: '/session?preset=flashcards&size=items:2' });

    const progress = await screen.findByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuenow', '1');
    expect(progress).toHaveAttribute('aria-valuemax', '2');
    expect(progress).toHaveAccessibleName(/item 1 of 2/i);
  });

  it('announces the result of an answer in a live region', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, { route: '/session?preset=vocabulary&size=items:1' });

    const choices = await screen.findAllByRole('button', { name: /beer|water|bread|coffee/ });
    await user.click(choices[0]!);

    const status = await screen.findByRole('status');
    expect(status.textContent).toMatch(/Correcto|Answer:/);
  });

  it('traps focus in the word panel and restores it on close', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, { route: '/session?preset=flashcards&size=items:1' });

    const word = await screen.findByRole('button', { name: 'About “Tengo”' });
    await user.click(word);

    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement | null),
    );

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(word);
  });

  it('marks the open word as expanded', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, { route: '/session?preset=flashcards&size=items:1' });

    const word = await screen.findByRole('button', { name: 'About “Tengo”' });
    expect(word).toHaveAttribute('aria-expanded', 'false');

    await user.click(word);
    expect(word).toHaveAttribute('aria-expanded', 'true');
  });

  it('labels Spanish content with its language for screen readers', async () => {
    const { container } = renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=items:1',
    });

    await screen.findByRole('button', { name: 'Reveal' });
    expect(container.querySelector<HTMLElement>('[lang="es"]')).not.toBeNull();
  });
});
