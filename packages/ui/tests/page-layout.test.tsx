import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PageLayout } from '../src/index.ts';
import styles from '../src/PageLayout.module.css';
import { RhythmLayout } from './fixtures/rhythm-layout';

describe('subject-neutral page layout', () => {
  it('runs a second subject with native navigation and no application providers', async () => {
    const user = userEvent.setup();
    const back = vi.fn();
    render(<RhythmLayout onBack={back} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Clap the pulse');
    expect(document.title).toBe('Pulse at 80 bpm · Rhythm lab');
    const main = screen.getByRole('main');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(within(main).getByRole('status')).toHaveTextContent('Keyboard tapping is ready.');
    expect(main.firstElementChild).toBe(screen.getByRole('status'));
    expect(
      within(screen.getByRole('banner')).getByRole('navigation', { name: 'Breadcrumb' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Rhythm' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      `#${main.id}`,
    );
    expect(main).toHaveAttribute('tabindex', '-1');
    const input = screen.getByRole('textbox', { name: 'Pattern name' });
    await user.clear(input);
    await user.type(input, 'Offbeats');
    await user.click(screen.getByRole('button', { name: 'Increase tempo' }));
    expect(document.title).toBe('Pulse at 90 bpm · Rhythm lab');
    expect(input).toHaveValue('Offbeats');
    await user.click(screen.getByRole('button', { name: 'Back to patterns' }));
    expect(back).toHaveBeenCalledOnce();
  });

  it('supports a bare screen and a host-provided title and skip label', () => {
    const { rerender } = render(
      <PageLayout title="Pulse" documentTitle="Pulse · Rhythm" skipLabel="Jump to practice">
        <button>Tap</button>
      </PageLayout>,
    );
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByRole('banner').querySelector('button')).toBeNull();
    expect(screen.getByRole('link', { name: 'Jump to practice' })).toHaveAttribute('href', '#main');
    expect(document.title).toBe('Pulse · Rhythm');
    rerender(
      <PageLayout title="Offbeats" subtitle="Rehearsal" documentTitle="Offbeats · Rhythm">
        <button>Tap</button>
      </PageLayout>,
    );
    expect(document.title).toBe('Offbeats · Rhythm');
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Offbeats');
    expect(within(screen.getByRole('banner')).getByText('Rehearsal')).toBeInTheDocument();
  });

  it('reserves fixed navigation space only when that layout and navigation are present', () => {
    const nav = (
      <nav aria-label="Patterns">
        <a href="#patterns">Patterns</a>
      </nav>
    );
    const { rerender } = render(
      <PageLayout title="Pulse" documentTitle="Pulse" navigation={nav}>
        Tap
      </PageLayout>,
    );
    const shell = screen.getByRole('main').parentElement!;
    expect(shell).not.toHaveClass(styles.withNav!);
    rerender(
      <PageLayout
        title="Pulse"
        documentTitle="Pulse"
        navigation={nav}
        navigationLayout="bar-rail"
        wide
      >
        Tap
      </PageLayout>,
    );
    expect(shell).toHaveClass(styles.withNav!, styles.wide!);
    rerender(
      <PageLayout
        title="Pulse"
        documentTitle="Pulse"
        navigation={false}
        navigationLayout="bar-rail"
        wide
      >
        Tap
      </PageLayout>,
    );
    expect(shell).not.toHaveClass(styles.withNav!);
    expect(shell).toHaveClass(styles.wide!);
  });
});
