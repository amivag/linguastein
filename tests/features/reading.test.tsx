/**
 * Reading: several sentences read as one text.
 *
 * The point of a passage is that its sentences stay ordinary items — so the
 * words are still tappable, the order is the author's, and the whole text can
 * be handed to a practice session.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { PassageScreen } from '../../src/features/read/PassageScreen';
import { ReadScreen } from '../../src/features/read/ReadScreen';
import { renderWithServices } from '../fixtures/services';

/** PassageScreen reads its id from the route, so it needs a real route match. */
function renderPassage(local: string) {
  return renderWithServices(
    <Routes>
      <Route path="/read/:id" element={<PassageScreen />} />
    </Routes>,
    { route: `/read/${local}` },
  );
}

describe('reading list', () => {
  it('lists the texts in the pack', async () => {
    renderWithServices(<ReadScreen />, { route: '/read' });

    expect(await screen.findByText('2 texts')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Un día de trabajo/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /¿Tienes tiempo\?/ })).toBeInTheDocument();
  });

  it('separates dialogues from texts', async () => {
    const user = userEvent.setup();
    renderWithServices(<ReadScreen />, { route: '/read' });

    await screen.findByText('2 texts');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Kind' }), 'dialogue');

    expect(await screen.findByText('1 text')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Un día de trabajo/ })).not.toBeInTheDocument();
  });

  it('shows how long a text is before you open it', async () => {
    renderWithServices(<ReadScreen />, { route: '/read' });

    const card = await screen.findByRole('link', { name: /Un día de trabajo/ });
    expect(card).toHaveTextContent('2 sentences');
  });
});

describe('a passage', () => {
  it('reads its sentences in the author’s order', async () => {
    renderPassage('700001');

    const lines = await screen.findByRole('list', { name: /Un día de trabajo/ });
    const texts = within(lines)
      .getAllByRole('listitem')
      .map((line) => line.textContent);

    expect(texts[0]).toContain('Tengo que trabajar.');
    expect(texts[1]).toContain('Tengo que irme.');
  });

  it('names who speaks each line of a dialogue', async () => {
    renderPassage('700002');

    await screen.findByRole('heading', { level: 1, name: '¿Tienes tiempo?' });
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Luis')).toBeInTheDocument();
  });

  it('keeps the meaning hidden until asked, so reading comes first', async () => {
    const user = userEvent.setup();
    renderPassage('700001');

    const toggle = await screen.findByRole('button', { name: 'Show meaning' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('I have to work.')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(await screen.findByText('I have to work.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide meaning' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('leaves every word inspectable, because the sentences are ordinary items', async () => {
    const user = userEvent.setup();
    renderPassage('700001');

    // A passage shows several sentences, so each word names the line it is in —
    // otherwise two lines both containing `Tengo` offer two identical controls.
    await user.click(
      await screen.findByRole('button', { name: 'About “Tengo” in “Tengo que trabajar.”' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('to have')).toBeInTheDocument();
  });

  /**
   * Names the id and points at the pack list. "Not found" alone cannot tell a
   * broken link from a pack that is not installed, and those have different
   * fixes — which matters more the moment add-on packs exist.
   */
  it('says which text is missing, and where it might come from', async () => {
    renderPassage('999999');

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('999999');
    expect(status).toHaveTextContent(/not installed/);
  });
});

describe('practising a passage', () => {
  it('scopes the session to that text’s sentences', async () => {
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=all&passage=700001&order=sequential',
    });

    // The fixture passage holds two of the pack's seven items.
    const progress = await screen.findByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuemax', '2');
  });

  it('still practises the whole pack without a passage', async () => {
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=all&order=sequential',
    });

    const progress = await screen.findByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuemax', '7');
  });

  it('practises nothing — not everything — for a passage that does not exist', async () => {
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=all&passage=999999&order=sequential',
    });

    expect(await screen.findByText('Nothing to practise here yet.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
