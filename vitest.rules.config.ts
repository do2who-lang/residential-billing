import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Config for the Firestore security-rules tests.
 *
 * These run against the Firestore emulator, so they are kept out of the default
 * unit-test run (`npm test`) and started through `npm run test:rules`, which
 * wraps the suite in `firebase emulators:exec`.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    // The emulator is a single shared instance, so run files sequentially.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 40000,
  },
});
