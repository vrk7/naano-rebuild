/**
 * Validated access to the environment variables this app cannot run without.
 *
 * `NEXT_PUBLIC_*` values are inlined by Next at build time, which only works
 * for static `process.env.X` expressions — a dynamic lookup such as
 * `process.env[name]` resolves to undefined in the browser bundle. Each one is
 * therefore read literally and then checked.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Add it to .env.local for local runs, or to the Vercel project settings for deployments.`,
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_ANON_KEY = required(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/**
 * The model key behind brand-profile generation (SCOPE.md,
 * `BrandIntelligenceProvider`).
 *
 * Optional, unlike everything above, and returning null rather than throwing is
 * the point: generation is a fake behind a seam, and an install without a key
 * still has to be able to onboard a brand. The provider reports itself
 * unavailable and the brand fills the ICP editor in by hand.
 */
export function googleApiKey(): string | null {
  const value = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  return value && value.trim() !== "" ? value : null;
}

/**
 * Server-only. Bypasses row level security, so this must never be imported
 * into a Client Component — `src/lib/supabase/admin.ts` is the only caller and
 * it is marked `server-only` to enforce that at build time.
 */
export function requireServiceRoleKey(): string {
  return required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
