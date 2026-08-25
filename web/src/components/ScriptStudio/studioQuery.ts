import { QueryClient } from '@tanstack/react-query';

/**
 * One query client for the panel's paged reads - Logs and Change history.
 *
 * Shared rather than one per page because the history panel appears twice (its
 * own modal, and a tab inside Logs) and two clients would mean the same fetch
 * cached twice, refetched twice, and out of step with itself.
 *
 * Not at the app root: these are the only surfaces doing paged fetches, and the
 * rest of dirk_lib's NUI stays untouched. Promote it if that changes.
 */
export const studioQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A log line is immutable once written and a saved change never changes,
      // so a page fetched a minute ago is still correct - going back to a
      // filter you already used should be instant, not another round trip.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
