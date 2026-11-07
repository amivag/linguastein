import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// TanStack restores scroll on navigation; jsdom has no layout to scroll.
window.scrollTo = () => {};

afterEach(() => {
  cleanup();
});
