import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Two projects, split by what each test actually needs.
 *
 * Building a jsdom is the dominant cost of this suite — in both time and
 * memory — and most tests here do not need one. Running the pure tests
 * (translation, formatting, CSV, dates) in a plain node environment makes
 * them an order of magnitude cheaper, and means the suite still runs on a
 * machine with a few hundred megabytes free. Before this split, parallel
 * jsdom workers failed to *start* under memory pressure, which surfaces as
 * "Failed to start worker" rather than a test failure and reads like a code
 * regression when it is not.
 *
 * A test belongs to the `dom` project if it touches *any* browser global —
 * not only `document` and `window`, but `localStorage`, `matchMedia`,
 * `navigator` and `location` too. The sprite-cache tests use `localStorage`,
 * which is why they sit there despite being plain `.ts`.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,

    // One worker at a time. The suite is small enough that serialising costs
    // little, and it keeps peak memory to a single environment.
    maxWorkers: 1,
    minWorkers: 1,

    // The default 4s is tight for a jsdom render driven through `userEvent`,
    // which advances real timers. Under load the auth-context interaction
    // test exceeded it while its logic was fine.
    testTimeout: 20_000,
    hookTimeout: 20_000,

    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: [
            "src/i18n/**/*.test.ts",
            "src/lib/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          // `jest-dom`'s matchers are only meaningful against a DOM, so the
          // setup file belongs to this project alone.
          setupFiles: ["./src/test/setup.ts"],
          include: [
            "src/**/*.test.tsx",
            // Uses `localStorage` for the sprite cache.
            "src/utils/svgSpriteUtils.test.ts",
            // Paints CSS custom properties onto a real element, and reads
            // the branding cache out of `localStorage`.
            "src/theme/*.test.ts",
            // Translating a refusal reads the locale off `<html lang>`.
            "src/auth/*.test.ts",
            // The setup draft lives in `localStorage`.
            "src/pages/Setup/*.test.ts",
          ],
        },
      },
    ],
  },
});
