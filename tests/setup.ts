import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * jsdom implements no media queries at all, and the app resolves the `system`
 * theme through one on mount. Anything that renders `App` itself needs this;
 * a stub that always reports "no match" is the light theme, which is a fine
 * default for a test that is not about theming.
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

/**
 * Newer Node versions define their own `localStorage` global, which is undefined
 * without `--localstorage-file` and which vitest does not replace with jsdom's.
 * Bound explicitly so the tests read the browser's storage on every supported
 * Node, rather than crashing on some of them.
 */
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
if (dom) {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: dom.window[name],
    });
  }
}

afterEach(() => {
  cleanup();
});
