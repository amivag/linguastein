/**
 * Boot fetches the course, not the pack.
 *
 * The build shards `sentences`, `forms` and `vocabulary` by level and the loader
 * has known how to skip since `tests/data/level-shards.test.ts` was written —
 * but the app asked for all of it anyway, so nothing had got faster. This is the
 * half that saves the bytes: 3.0 MB of the 6.3 for an A1 course, the rest
 * fetched behind the first screen, and a level chip that waits rather than lies
 * if it is tapped before that lands (`docs/tasks/shard-loading.md`).
 *
 * The assertions are on the paths a `DatasetSource` was asked for, because that
 * is the thing that costs a learner something. Everything else here — the counts
 * on the chips, the content a widened course shows — is downstream of it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import type { ContentLoading } from '../../src/app/content';
import type { OfflinePacks } from '../../src/app/offline';
import * as boot from '../../src/app/services';
import { createServices } from '../../src/app/services';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import {
  ContentRepository,
  courseOptions,
  LEVEL_SCOPE_ALL,
  type ContentPack,
  type LevelScope,
} from '../../src/domain/content';
import { repoRoot } from '../fixtures/dataset';
import { TEST_PACK_FR, TEST_PACK_ID } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';
import { createStorage } from '../../src/storage';

const PUBLIC = join(repoRoot, 'public');

/** The shipped packs over a stubbed `fetch`, remembering what was asked for. */
function servePacks(): { readonly fetched: string[] } {
  const fetched: string[] = [];
  vi.stubGlobal('fetch', (input: string) => {
    fetched.push(input);
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(readFileSync(join(PUBLIC, input), 'utf8')),
    });
  });
  return { fetched };
}

/** Just the levels of the shards asked for, in the order they were asked for. */
const shards = (fetched: readonly string[]): string[] =>
  fetched.filter((path) => /-(a1|a2|b1)\.jsonl$/.test(path)).map((path) => path.slice(-8, -6));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a cold load', () => {
  it('fetches the shards the address asks for, and no others', async () => {
    const served = servePacks();
    const services = await createServices({ path: '/es/a1' });

    expect(shards(served.fetched)).toEqual(['a1', 'a1', 'a1']);
    // The unsharded files come whatever the course is: they carry no level, and
    // translations could not carry one.
    expect(served.fetched.some((path) => path.endsWith('-translations-en.jsonl'))).toBe(true);
    expect(services.repository.query({}).every((item) => item.level === 'a1')).toBe(true);
  });

  it('falls back to where the learner left off, because `/` is about to go there', async () => {
    // The commonest entry point names no course: the app has no course-less home,
    // so `/` redirects to the stored one a moment later. Fetching everything here
    // would spend the whole saving on the address a learner opens most.
    const served = servePacks();
    await createServices({ path: '/' });

    expect(shards(served.fetched)).toEqual(['a1', 'a1', 'a1']);
  });

  /**
   * And "where they left off" is now a fact about the *course*, not the device.
   *
   * One global level could not hold Spanish-at-B1 and French-at-A1
   * (`docs/tasks/learner-profile.md` §4.1), so boot reads the ceiling out of the
   * course the pointer names. Worth its own case because getting it wrong is
   * invisible rather than broken: the app would open at A1 and silently work,
   * having thrown away the ceiling the learner had climbed to.
   */
  it('reads that ceiling from the course, not from one global level', async () => {
    const storage = await createStorage();
    await storage.preferences.write({ targetLanguage: 'es' });
    await storage.courses.write('es', { level: 'b1' });

    const served = servePacks();
    await createServices({ path: '/' });

    expect(shards(served.fetched).sort()).toEqual(['a1', 'a1', 'a1', 'a2', 'a2', 'a2', 'b1', 'b1', 'b1']); // prettier-ignore
  });

  it('widens a ceiling the pack does not declare, rather than fetching nothing', async () => {
    // `a3` is a well-formed level id and no pack declares one. Nothing has
    // resolved it yet — that happens against the loaded courses, which is what
    // this load is producing — so the safe direction here is the whole pack.
    const served = servePacks();
    await createServices({ path: '/es/a3' });

    expect(shards(served.fetched).sort()).toEqual(['a1', 'a1', 'a1', 'a2', 'a2', 'a2', 'b1', 'b1', 'b1']); // prettier-ignore
  });
});

describe('a course described before its content', () => {
  it('offers every level the pack declares, with its real count', async () => {
    servePacks();
    const { repository } = await createServices({ path: '/es/a1' });
    const [spanish] = courseOptions(repository);

    // B1 is unfetched and still on offer: it is the chip a learner taps to *get*
    // B1, and a count taken from memory would describe a smaller course rather
    // than an unloaded one.
    expect(spanish?.levels.map((entry) => entry.level)).toEqual(['a1', 'a2', 'b1', 'all']);

    const counts = new Map(spanish?.levels.map((entry) => [entry.level, entry.count]));
    expect(counts.get('a1')).toBe(2059);
    // Cumulative, from the pack's own exact per-level figures.
    expect(counts.get('b1')).toBe(3816);
    expect(counts.get('all')).toBe(3816);
  });
});

describe('widening the course', () => {
  it('fetches only the shards it does not have, and only once', async () => {
    const served = servePacks();
    const services = await createServices({ path: '/es/a1' });
    served.fetched.length = 0;

    await services.content.ensure('b1');

    expect(shards(served.fetched).sort()).toEqual(['a2', 'a2', 'a2', 'b1', 'b1', 'b1']);
    // The unsharded files were indexed at boot; re-reading them would list every
    // translation twice.
    expect(served.fetched.some((path) => path.endsWith('-translations-en.jsonl'))).toBe(false);
    expect(services.repository.query({ levels: ['b1'] }).length).toBeGreaterThan(0);

    served.fetched.length = 0;
    await services.content.ensure('b1');
    expect(served.fetched).toEqual([]);
  });

  it('fetches nothing to narrow, because a lower ceiling is already in memory', async () => {
    const served = servePacks();
    const services = await createServices({ path: '/es/b1' });
    served.fetched.length = 0;

    expect(services.content.has('a1')).toBe(true);
    await services.content.ensure('a1');
    expect(served.fetched).toEqual([]);
  });

  it('asks once when two callers want the same shards', async () => {
    // The race worth a test: the background prefetch is in flight when a learner
    // taps a chip. The second caller waits on the first rather than fetching the
    // same 3.3 MB again.
    const served = servePacks();
    const services = await createServices({ path: '/es/a1' });
    served.fetched.length = 0;

    await Promise.all([services.content.ensure('all'), services.content.ensure('b1')]);

    expect(shards(served.fetched).sort()).toEqual(['a2', 'a2', 'a2', 'b1', 'b1', 'b1']);
  });
});

describe('the levels above the ceiling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  /** An app whose device is holding `cached` of the pack's four files. */
  async function bootWith(cached: number) {
    const ensured: LevelScope[] = [];
    const content: ContentLoading = {
      has: () => true,
      ensure: (level) => {
        ensured.push(level);
        return Promise.resolve();
      },
      // Not what this suite is about: meanings are fetched by reference language
      // rather than by level, so a stub for the shard half holds them all.
      hasReference: () => true,
      ensureReference: () => Promise.resolve(),
      translationUnits: () => [],
      availableReferences: () => [],
      issues: () => [],
    };
    const status = () =>
      Promise.resolve([{ pack: TEST_PACK_ID, files: 4, cached, bytes: 6_400_000, cachedBytes: 0 }]);
    const offline: OfflinePacks = {
      supported: true,
      status,
      install: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    };

    vi.spyOn(boot, 'createServices').mockResolvedValue(testServices({ content, offline }));
    window.history.pushState({}, '', '/es/a1');
    await act(async () => {
      render(<App />);
    });
    return ensured;
  }

  it('are left on the server while the device is not keeping the pack', async () => {
    // 3.3 MB of somebody's data plan is not a reasonable price for making a rare
    // interaction instant. A chip tapped meanwhile waits, which is what the
    // loading state below is for.
    expect(await bootWith(1)).toEqual([]);
  });

  it('are read into memory when they are already on the device', async () => {
    // Nothing is downloaded here: the pack is kept, so this costs a disk read
    // and buys an instant level chip.
    expect(await bootWith(4)).toEqual([LEVEL_SCOPE_ALL]);
  });
});

describe('a level tapped before its shards have landed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('waits behind the loading state, rather than showing an empty course', async () => {
    const repository = ContentRepository.from([
      { ...TEST_PACK_FR, items: TEST_PACK_FR.items.filter((item) => item.level !== 'b1') },
    ]);
    const late: ContentPack = {
      ...TEST_PACK_FR,
      items: TEST_PACK_FR.items.filter((item) => item.level === 'b1'),
      translations: [],
    };

    let land = () => {};
    const landed = new Promise<void>((resolve) => {
      land = resolve;
    });
    let held = false;
    const content: ContentLoading = {
      has: (level) => level !== 'b1' || held,
      ensure: async () => {
        await landed;
        held = true;
        repository.add(late);
      },
      hasReference: () => true,
      ensureReference: () => Promise.resolve(),
      translationUnits: () => [],
      availableReferences: () => [],
      issues: () => [],
    };

    vi.spyOn(boot, 'createServices').mockResolvedValue(testServices({ repository, content }));
    window.history.pushState({}, '', '/fr/b1/browse');
    // Boot flushed inside `act`, so what is on screen afterwards is the gate's
    // decision rather than a render still in flight.
    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('bonjour')).not.toBeInTheDocument();

    await act(async () => {
      land();
      await landed;
    });

    // No navigation: the same address, now with the content it names.
    expect(await screen.findByText('bonjour')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/fr/b1/browse');
  });
});

describe('a screen open when late shards arrive', () => {
  it('shows them without a navigation', async () => {
    // The French fixture at B1 with only its A1 shard loaded: what a course looks
    // like between the chip being tapped and the rest arriving. The manifest is
    // the same one either way, which is why the course is offered at all.
    const loaded: ContentPack = {
      ...TEST_PACK_FR,
      items: TEST_PACK_FR.items.filter((item) => item.level !== 'b1'),
    };
    const late: ContentPack = {
      ...TEST_PACK_FR,
      items: TEST_PACK_FR.items.filter((item) => item.level === 'b1'),
      translations: [],
    };
    const repository = ContentRepository.from([loaded]);

    renderWithServices(
      <Routes>
        <Route path="/:language/:level/browse" element={<BrowseScreen />} />
      </Routes>,
      { services: testServices({ repository }), route: '/fr/b1/browse' },
    );

    expect(await screen.findByText('Je dois travailler.')).toBeInTheDocument();
    expect(screen.queryByText('bonjour')).not.toBeInTheDocument();

    act(() => {
      repository.add(late);
    });

    expect(await screen.findByText('bonjour')).toBeInTheDocument();
  });
});
