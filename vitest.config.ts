import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';

/**
 * Unit + component tests. Deliberately separate from vite.config.ts: the Tailwind plugin
 * isn't needed to run tests and pulling it in slows every run for no benefit.
 *
 * Nothing special is configured for `functions/` — tests/scoring-mirror.test.ts is picked up
 * by the `tests/` glob below and simply imports functions/src/scoring.ts directly, running it
 * against the same fixtures as the client implementation. That test is what makes a
 * divergence between the two mirrored scoring files fail the build.
 *
 * Note what it does and doesn't prove: it asserts the two implementations AGREE, not that
 * either is correct. Break both the same way and it stays green. Correctness is pinned by the
 * hardcoded expectations in src/lib/scoring.test.ts.
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
    // Emulator-backed tests live in tests/e2e. They're vitest too, but need the Firebase
    // emulators running, so they're excluded here and driven by `npm run test:e2e`.
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
  },
});
