import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { fetchNui, isEnvBrowser } from 'dirk-cfx-react';
import { fetchLogFacets, fetchLogs, MOCK_DELIVERY, type Facet, type LogPage, type LogQuery } from './mockLogs';

/**
 * The Logs page, reading the server's own log table.
 *
 * Three queries, deliberately separate, because they are asked for at very
 * different rates:
 *
 *   * ROWS are paged as you scroll, by keyset - the cursor is the last id
 *     seen, so a page cannot skip or repeat a line when new ones arrive
 *     underneath, which offset paging does constantly on a table being
 *     written to.
 *   * FACETS - which resources and events exist - change slowly and are the
 *     expensive query (a GROUP BY over the window). Cached hard on both sides:
 *     a minute on the server, five here.
 *   * HEALTH - row count and size - is a footnote, and read from
 *     information_schema rather than counted.
 *
 * Nothing polls. A log page that refetches on a timer is a page that costs
 * something while nobody is looking at it.
 */

export type Facets = {
  resources: Facet[];
  events: Facet[];
  levels: Facet[];
  /** the sink is switched off, so there is nothing to filter */
  off?: boolean;
};

/**
 * How many lines the window holds, for the "All resources" row.
 *
 * Summed from the resource counts rather than asked for separately: a COUNT(*)
 * over the filtered window is the one query on this page expensive enough to
 * be worth not running, and the facets already carry every part of it.
 */
export function facetTotal(facets?: Facets): number | undefined {
  if (!facets) return undefined;
  return facets.resources.reduce((sum, entry) => sum + entry.count, 0);
}

/** One Discord webhook's delivery health. Never carries the URL - that is a
 *  secret, and this payload is read by anyone who can see the page. */
export type RouteHealth = {
  id?: string;
  label?: string;
  enabled: boolean;
  resources?: string[];
  events?: string[];
  levels?: string[];
  sent: number;
  dropped: number;
  /** unix seconds of the last successful post */
  lastAt?: number;
  /** lines waiting to go out right now */
  queued: number;
};

export type LogHealth = {
  enabled: boolean;
  rows: number;
  bytes: number;
  retentionDays: number;
  routes?: RouteHealth[];
};

/** Unwrap dirk_lib's bridge envelope, or say why not. */
async function ask<T>(callback: string, payload?: unknown): Promise<T> {
  const reply = await fetchNui<{ success: boolean; data?: T; _error?: string }>(callback, payload ?? {});
  if (!reply?.success) throw new Error(reply?._error ?? 'NoAnswer');
  return reply.data as T;
}

/** One page at a time, newest first. */
export function useLogRows(query: LogQuery) {
  // The filters are the cache key, so changing one starts a fresh scroll
  // rather than appending to the previous filter's pages.
  const key = [
    'logs', query.resource ?? '', query.event ?? '', query.level ?? '',
    query.player ?? '', query.search ?? '', query.since ?? '',
  ];

  return useInfiniteQuery({
    queryKey: key,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      const args = { ...query, cursor: pageParam, limit: 50 };
      if (isEnvBrowser()) return fetchLogs(args);
      return ask<LogPage>('GET_LOGS', args);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // A log line never changes once written, so a page already fetched is
    // never stale. Only the FIRST page can gain rows, and the reader asks for
    // that by refreshing rather than by us guessing.
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** What is worth filtering by. */
export function useLogFacets(resource?: string | null, since?: number | null) {
  return useQuery({
    queryKey: ['log-facets', resource ?? '', since ?? ''],
    queryFn: async (): Promise<Facets> => {
      if (isEnvBrowser()) {
        // The mock predates levels and returns its own total; normalised here
        // so the page only ever sees one shape.
        const mock = await fetchLogFacets(since ?? null);
        return { resources: mock.resources, events: mock.events, levels: [] };
      }
      return ask<Facets>('GET_LOG_FACETS', { resource, since });
    },
    // Five minutes: the expensive query behind this is already cached a minute
    // server-side, and the answer is a list of script names.
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** How much is being kept, and whether the sink is even on. */
export function useLogHealth() {
  return useQuery({
    queryKey: ['log-health'],
    queryFn: async () => {
      if (isEnvBrowser()) {
        return {
          enabled: MOCK_DELIVERY.local.enabled,
          rows: MOCK_DELIVERY.local.rows,
          bytes: MOCK_DELIVERY.local.bytes,
          retentionDays: MOCK_DELIVERY.local.retentionDays,
          routes: MOCK_DELIVERY.routes,
        } as LogHealth;
      }
      return ask<LogHealth>('GET_LOG_HEALTH');
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Bytes, as a person reads them. */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
