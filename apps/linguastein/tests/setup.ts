import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// The router restores scroll on navigation; jsdom has no layout to scroll.
if (typeof window !== 'undefined') window.scrollTo = () => {};

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
 * Node defines its own `localStorage` global, which is undefined without
 * `--localstorage-file` and which vitest does not replace with jsdom's. Bound
 * explicitly so the tests read the browser's storage rather than crashing on it.
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
