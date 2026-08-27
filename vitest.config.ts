import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests live next to nothing in particular yet; this picks them up whether
    // they end up in tests/ or beside the code they cover.
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
    environment: "node",
  },
});
