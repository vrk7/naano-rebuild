import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" -> "./src/*" alias in tsconfig.json so tests import
    // app code by the same path the app does.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      /*
       * `server-only` exists to make importing a server module from a Client
       * Component a build error. Outside Next there is no such distinction and
       * the package throws on import, which would put every server module —
       * the website reader, the model provider — permanently out of reach of a
       * test. The stub is empty on purpose: the guard it replaces is enforced
       * at build time, by Next, where it means something.
       */
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    // Tests live next to nothing in particular yet; this picks them up whether
    // they end up in tests/ or beside the code they cover.
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
    environment: "node",
    // Loads .env.local so the access-control tests can reach Supabase.
    setupFiles: ["./tests/setup-env.ts"],
    // RLS tests create users and fixtures over the network.
    testTimeout: 30_000,
    /*
     * Test files run one at a time.
     *
     * Four of them build fixtures against the real Supabase project, and each
     * signs a handful of users in. Run concurrently they trip the hosted auth
     * rate limit — "Request rate limit reached" out of signInWithPassword —
     * which fails whole suites at beforeAll, roughly one run in four. The
     * failure is in the fixture, never in the thing under test, which is the
     * worst kind: it teaches you to re-run rather than to read.
     *
     * Serialising costs wall time on a suite that is otherwise seconds, and
     * buys a result that means what it says. The alternative — retrying the
     * sign-in — keeps the suite fast but makes every future rate-limit problem
     * invisible.
     */
    fileParallelism: false,
    hookTimeout: 60_000,
  },
});
