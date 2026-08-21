/**
 * What a thrown render looks like to a learner.
 *
 * Before this existed, it looked like nothing: a blank page, no message, no way
 * back, and on the phone the app is actually used on, no console to inspect. The
 * boot path was handled — a dataset that will not load says so — but a throw from
 * inside a screen was not, which is the failure far more likely to reach anyone.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../../src/app/ErrorBoundary';

function Boom({ message = 'the sky fell' }: { readonly message?: string }): never {
  throw new Error(message);
}

/**
 * React logs a caught error to `console.error` itself, on top of whatever the
 * boundary does. Silenced per test so a passing run is not full of red that means
 * everything is working.
 */
function quietly<T>(run: () => T): T {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    return run();
  } finally {
    spy.mockRestore();
  }
}

describe('a screen that throws', () => {
  it('renders its children untouched when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>the app, working</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('the app, working')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says what happened rather than showing a blank page', () => {
    quietly(() =>
      render(
        <ErrorBoundary onError={() => {}}>
          <Boom />
        </ErrorBoundary>,
      ),
    );

    // `role="alert"` so it is announced, not merely drawn.
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Something went wrong');
  });

  it('promises that stored progress is untouched, because it is', () => {
    // The boundary clears nothing. Said out loud because the instinct on seeing
    // an error screen is to assume the worst and reset — which is how a bug a
    // reload would have survived costs someone their history.
    quietly(() =>
      render(
        <ErrorBoundary onError={() => {}}>
          <Boom />
        </ErrorBoundary>,
      ),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/progress .* has not been touched/i);
  });

  it('quotes the error, so a bug report can carry it', () => {
    quietly(() =>
      render(
        <ErrorBoundary onError={() => {}}>
          <Boom message="tokens read before paint" />
        </ErrorBoundary>,
      ),
    );

    expect(screen.getByText('tokens read before paint')).toBeInTheDocument();
  });

  it('offers a reload rather than an in-app navigation', async () => {
    const reload = vi.fn();
    // jsdom's `location.reload` is not writable, so the property is replaced.
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, reload },
    });

    try {
      quietly(() =>
        render(
          <ErrorBoundary onError={() => {}}>
            <Boom />
          </ErrorBoundary>,
        ),
      );

      await userEvent.click(screen.getByRole('button', { name: 'Reload the app' }));

      // A navigation would leave the broken tree mounted and the boundary would
      // catch the same throw again; a reload rebuilds from nothing.
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });

  it('reports through the seam rather than straight to the console', () => {
    const onError = vi.fn();
    quietly(() =>
      render(
        <ErrorBoundary onError={onError}>
          <Boom message="reported" />
        </ErrorBoundary>,
      ),
    );

    // The seam exists so a project can wire a reporter in `services.ts` without
    // this file learning about the network — the one code path that runs when
    // things are already wrong is the worst place to add a fetch.
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect((onError.mock.calls[0]?.[0] as Error).message).toBe('reported');
  });

  it('falls back to the console when no reporter is wired', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <ErrorBoundary>
          <Boom message="unreported" />
        </ErrorBoundary>,
      );
      // Swallowing it entirely would be worse for diagnosis than the blank page
      // this replaced: at least that was visibly wrong.
      expect(spy.mock.calls.some((call) => call[0] === 'Unhandled error in the interface')).toBe(
        true,
      );
    } finally {
      spy.mockRestore();
    }
  });
});
