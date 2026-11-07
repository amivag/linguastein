import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      // Floors, not targets: just under what the suite reaches. Raise, never lower.
      thresholds: { statements: 90, branches: 82, functions: 85, lines: 92 },
    },
  },
});
