import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';

/**
 * Unit + component tests. Deliberately separate from vite.config.ts: the Tailwind plugin
 * isn't needed to run tests and pulling it in slows every run for no benefit.
 *
 * `functions/` is included in the project list because the scoring mirror test imports BOTH
 * src/lib/scoring.ts and functions/src/scoring.ts and runs them against identical fixtures.
 * That test is what turns the "these two files are mirrors" rule in CLAUDE.md from a comment
 * someone has to remember into something the build enforces.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    // Emulator-backed E2E lives in tests/e2e and runs under Playwright, not here.
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
  },
});
