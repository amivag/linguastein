/**
 * Settings → Packs as the install surface, which is what the packs leaving the
 * precache made it.
 *
 * A pack used to arrive with the app: 6.3 MB fetched by a service worker before
 * the first screen, with nothing to say about it because there was nothing to
 * decide. Now the app fetches the shards its course reads and the rest is a
 * download — so this screen has to answer "is it here?", say what finishing it
 * costs *before* it starts, and let a learner take it back off the device.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { OfflinePacks, PackOffline } from '../../src/app/offline';
import { PackSettings } from '../../src/features/settings/PackSettings';
import { TEST_PACK_ID } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

/** A device holding some of the pack, and the two controls that change that. */
function offlinePacks(initial: Partial<PackOffline> = {}) {
  let held: PackOffline = {
    pack: TEST_PACK_ID,
    files: 4,
    cached: 1,
    bytes: 6_400_000,
    cachedBytes: 1_200_000,
    ...initial,
  };
  const packs: OfflinePacks = {
    supported: true,
    status: () => Promise.resolve([held]),
    install: vi.fn(() => {
      held = { ...held, cached: held.files, cachedBytes: held.bytes };
      return Promise.resolve();
    }),
    remove: vi.fn(() => {
      held = { ...held, cached: 0, cachedBytes: 0 };
      return Promise.resolve();
    }),
  };
  return packs;
}

describe('a pack that is only partly on the device', () => {
  it('says what is here, and what finishing it would cost', async () => {
    renderWithServices(<PackSettings />, {
      services: testServices({ offline: offlinePacks() }),
    });

    expect(await screen.findByText('Partly on this device · 1.2 MB of 6.4 MB')).toBeInTheDocument();
    // The remaining download rather than the whole pack: a learner who has been
    // studying A1 already has most of the A1 half.
    expect(await screen.findByRole('button', { name: /5\.2 MB/ })).toBeInTheDocument();
  });

  it('downloads the rest when asked, and then says it is available offline', async () => {
    const offline = offlinePacks();
    renderWithServices(<PackSettings />, { services: testServices({ offline }) });

    await userEvent.click(await screen.findByRole('button', { name: /Keep Test Spanish offline/ }));

    expect(offline.install).toHaveBeenCalledWith(TEST_PACK_ID, expect.any(Function));
    expect(await screen.findByText('Available offline · 6.4 MB')).toBeInTheDocument();
  });
});

describe('a pack that is here in full', () => {
  it('offers to take it off the device, and reports what is left when it goes', async () => {
    const offline = offlinePacks({ cached: 4, cachedBytes: 6_400_000 });
    renderWithServices(<PackSettings />, { services: testServices({ offline }) });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove Test Spanish from this device' }),
    );

    expect(offline.remove).toHaveBeenCalledWith(TEST_PACK_ID);
    await waitFor(() => expect(screen.getByText('Not kept on this device')).toBeInTheDocument());
  });
});

describe('a browser that cannot keep anything', () => {
  it('says so rather than offering a button that would do nothing', async () => {
    // The default fixture: jsdom has no Cache Storage, which is also the honest
    // answer for a browser without it.
    renderWithServices(<PackSettings />, { services: testServices() });

    expect(
      await screen.findByText(/This browser cannot keep packs on the device/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Keep/ })).not.toBeInTheDocument();
  });
});
