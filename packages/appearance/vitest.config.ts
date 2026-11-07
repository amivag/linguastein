import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      // Floors, not targets: held where the app held this code before it moved.
      thresholds: { statements: 88, branches: 76, functions: 90, lines: 92 },
    },
  },
});
