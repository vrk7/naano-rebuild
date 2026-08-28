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
    hookTimeout: 60_000,
  },
});
