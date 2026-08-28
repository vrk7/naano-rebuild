import { QueryClient, environmentManager } from "@tanstack/react-query";

/**
 * With SSR, data is already fresh when it reaches the browser. A staleTime of
 * zero would make every hydrated query refetch immediately on mount, throwing
 * away the server render. One minute is the value TanStack's SSR guide
 * recommends as a starting point — it is a default, not a measured figure, and
 * per-query overrides are expected once real queries exist.
 */
const DEFAULT_STALE_TIME_MS = 60 * 1000;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: DEFAULT_STALE_TIME_MS },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * On the server, always a fresh client so requests cannot share cache state.
 * In the browser, a single client that survives re-renders and suspense.
 */
export function getQueryClient() {
  if (environmentManager.isServer()) {
    return makeQueryClient();
  }

  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
