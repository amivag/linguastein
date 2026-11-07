import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      // Floors, not targets: just under what the suite reaches. Raise, never lower.
      thresholds: { statements: 98, branches: 92, functions: 98, lines: 98 },
    },
  },
});
