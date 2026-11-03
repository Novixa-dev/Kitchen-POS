import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],

    // One worker at a time.
    //
    // Each worker builds its own jsdom, which is the dominant memory cost of
    // this suite. Running them in parallel on a machine with a couple of
    // hundred megabytes free makes workers fail to *start* — which surfaces as
    // "Failed to start worker" rather than a test failure, so it reads like a
    // code regression when it is not. The suite is small enough that
    // serialising it costs little and makes it run anywhere.
    //
    // `maxWorkers` is the Vitest 4 spelling; `poolOptions.forks.singleFork`
    // was removed.
    maxWorkers: 1,
    minWorkers: 1,

    // The default 4s is tight for a jsdom render driven through `userEvent`,
    // which advances real timers. Under load the auth-context interaction test
    // exceeded it while its logic was fine.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
