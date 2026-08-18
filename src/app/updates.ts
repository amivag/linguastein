/**
 * "A new version is ready" — as a signal React can read.
 *
 * The service worker registers in `main.tsx`, outside the tree and before
 * anything renders, so the notification has to cross into React somehow. A
 * single-value store read through `useSyncExternalStore` is the whole mechanism.
 *
 * Why a prompt rather than an automatic reload: `vite-plugin-pwa`'s `autoUpdate`
 * mode calls `window.location.reload()` itself the moment a new worker takes
 * over. That can land mid-answer, and since a session is described by its URL the
 * learner is dropped back at its start with the current item's work lost. Passing
 * `onNeedReload` suppresses that reload and hands the timing to the person
 * practising — the new assets are already cached either way, so nothing is lost
 * by waiting.
 */

import { useSyncExternalStore } from 'react';

let updateReady = false;
const listeners = new Set<() => void>();

/** Called by the service-worker registration when a new build has activated. */
export function markUpdateReady(): void {
  if (updateReady) return;
  updateReady = true;
  for (const listener of [...listeners]) listener();
}

export function subscribeToUpdates(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isUpdateReady(): boolean {
  return updateReady;
}

/** Reloads into the build the worker has already cached. */
export function applyUpdate(): void {
  window.location.reload();
}

/** Whether a newer build is waiting to be loaded. */
export function useUpdateReady(): boolean {
  return useSyncExternalStore(subscribeToUpdates, isUpdateReady, () => false);
}

/**
 * Test-only reset: the flag is module state, so it outlives an unmounted tree
 * and would otherwise leak between cases.
 */
export function resetUpdateState(): void {
  updateReady = false;
  listeners.clear();
}
