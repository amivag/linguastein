/**
 * What boot says while it cannot finish.
 *
 * A database upgrade waits for every older tab to close. Boot resumes by itself
 * when that happens, but until then "Loading…" would be a lie that never ends.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import * as services from '../../src/app/services';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('booting while another tab holds the database', () => {
  it('says what it is waiting for and what will release it', async () => {
    vi.spyOn(services, 'createServices').mockImplementation((options) => {
      options?.onStorageBlocked?.();
      return new Promise(() => {});
    });

    render(<App />);

    expect(
      await screen.findByText(/Finishing an update\. Close any other Linguastein tabs/),
    ).toBeInTheDocument();
  });

  it('just loads when nothing is in the way', () => {
    vi.spyOn(services, 'createServices').mockReturnValue(new Promise(() => {}));

    render(<App />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});
