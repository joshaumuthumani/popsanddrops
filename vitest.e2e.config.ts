import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/**
 * Emulator-backed tests. Separate from vitest.config.ts on purpose:
 *   - node environment, not jsdom — these talk to the emulators over the network
 *   - no React plugin
 *   - single-threaded, because every test shares one emulator instance and clearFirestore()
 *     between parallel files would wipe data out from under a sibling test
 *
 * Run via `npm run test:e2e`, which boots the emulator suite around it.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/e2e/**/*.test.ts'],
    fileParallelism: false,
    // Emulator round-trips and the first-call JVM warmup are slower than unit tests.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
