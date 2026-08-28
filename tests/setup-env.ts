import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Loads .env.local into process.env for tests that talk to the real Supabase
 * project. Next loads this file itself at runtime; Vitest does not.
 *
 * Existing values win, so CI can inject its own credentials without the file
 * overriding them.
 */
const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));

try {
  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
} catch (error) {
  // Absent .env.local is fine — the tests that need credentials skip
  // themselves and say so. Anything else is a real problem worth surfacing.
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
