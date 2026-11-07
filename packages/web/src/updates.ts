/**
 * "A new version is ready", and "this tab must reload", as signals React can read.
 *
 * The service worker registers in `main.tsx`, outside the tree and before
 * anything renders, so the notification has to cross into React somehow. A
 * small store read through `useSyncExternalStore` is the whole mechanism.
 *
 * Why a prompt rather than an automatic reload: `vite-plugin-pwa`'s `autoUpdate`
 * mode calls `window.location.reload()` itself the moment a new worker takes
 * over. That can land mid-answer, and since a session is described by its URL the
 * learner is dropped back at its start with the current item's work lost. Passing
 * `onNeedReload` suppresses that reload and hands the timing to the person
 * practising — the new assets are already cached either way, so nothing is lost
 * by waiting.
 *
 * The one case where waiting does lose something is a closed database
 * connection. A newer build in another tab took the database over, or the browser
 * terminated it, and this tab can no longer save. That state is `required`, and it
 * is not dismissible.
 */

import { useSyncExternalStore } from 'react';

export type UpdateState = 'none' | 'ready' | 'required';

let state: UpdateState = 'none';
const listeners = new Set<() => void>();

function publish(next: UpdateState): void {
  if (state === next || state === 'required') return;
  state = next;
  for (const listener of [...listeners]) listener();
}

/** Called by the service-worker registration when a new build has activated. */
export function markUpdateReady(): void {
  publish('ready');
}

/** Called when this tab can no longer write its learner's data. */
export function markReloadRequired(): void {
  publish('required');
}

export function subscribeToUpdates(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateState(): UpdateState {
  return state;
}

export function isUpdateReady(): boolean {
  return state !== 'none';
}

/** Reloads into the build the worker has already cached. */
export function applyUpdate(): void {
  window.location.reload();
}

/** Whether a newer build is waiting to be loaded, or this tab must reload. */
export function useUpdateState(): UpdateState {
  return useSyncExternalStore(subscribeToUpdates, updateState, () => 'none');
}

/** Whether a newer build is waiting to be loaded. */
export function useUpdateReady(): boolean {
  return useUpdateState() !== 'none';
}

/**
 * Test-only reset: the flag is module state, so it outlives an unmounted tree
 * and would otherwise leak between cases.
 */
export function resetUpdateState(): void {
  state = 'none';
  listeners.clear();
}
