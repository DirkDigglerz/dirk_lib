import { useQuery } from '@tanstack/react-query';
import type { DispatchEntry } from './Dispatch';

/**
 * What is going on outside this server.
 *
 * A script ships with its own CHANGELOG.md, and that file can only ever
 * describe the build it shipped in - it cannot know about a release that came
 * after it. This is the part that can: a small public repo holding the
 * announcement feed, the current version of each script, and a copy of each
 * changelog.
 *
 * Fetched by the PANEL, not by the server.
 *
 * The server has no business making outbound requests on a customer's behalf,
 * and a boot-time fetch would have meant every server that runs a dirk script
 * calling home whether anyone ever opened the panel or not. An admin opening
 * the panel is the moment this information is wanted, and it is their machine
 * that asks for it. Nothing about the server leaves the server.
 *
 * Everything here fails quietly. This is a nicety on top of a settings panel:
 * if GitHub is unreachable, or a firewall blocks it, the panel works exactly
 * as it did before and simply has nothing to announce.
 */

const BASE = 'https://raw.githubusercontent.com/DirkScripts-FiveM/dirk_publicInfo/main';

export type PublicInfo = {
  schema?: number;
  /** resource -> the version currently released */
  versions: Record<string, string>;
  announcements: (DispatchEntry & {
    /** only for servers running this resource */
    resource?: string;
    /** only for servers on this version or above */
    minVersion?: string;
  })[];
};

const EMPTY: PublicInfo = { versions: {}, announcements: [] };

/**
 * `2.0.9` is newer than `2.0.10` if you compare them as text.
 *
 * Which is exactly the case that matters, because that is what a version does
 * on its tenth patch. Compared piece by piece as numbers instead, with a
 * missing piece counting as zero so `1.2` and `1.2.0` agree.
 */
export function compareVersions(a: string, b: string): number {
  const left = String(a ?? '').split(/[.\-+]/);
  const right = String(b ?? '').split(/[.\-+]/);

  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const x = parseInt(left[i] ?? '0', 10);
    const y = parseInt(right[i] ?? '0', 10);
    // A piece that is not a number at all - `3.0.0-rebuild` - stops the
    // comparison rather than guessing at an ordering for it.
    if (Number.isNaN(x) || Number.isNaN(y)) return 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/** The announcement feed and the current version of every script. */
export function usePublicInfo() {
  return useQuery({
    queryKey: ['public-info'],
    queryFn: async (): Promise<PublicInfo> => {
      // No-store: a CDN copy that is a day stale is worse than one request.
      const res = await fetch(`${BASE}/announcements.json`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as PublicInfo;
      return {
        versions: body?.versions ?? {},
        announcements: Array.isArray(body?.announcements) ? body.announcements : [],
      };
    },
    // Announcements are not urgent, and the panel is opened and closed a lot.
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    // The panel is fully usable without this, so a failure must look like
    // "nothing to announce" rather than an error anybody has to read.
    throwOnError: false,
    placeholderData: EMPTY,
  });
}

/**
 * A script's changelog, from the repo rather than from the build.
 *
 * REMOTE first, deliberately. The question this page mostly answers is
 * "should I update", and the file inside the resource cannot answer it - it
 * describes the build you already have. The remote copy carries the entries
 * that would arrive if you did update, and the installed version is marked in
 * the list so it is clear which ones you already have.
 *
 * It also sidesteps escrow: a changelog that is not in `escrow_ignore` cannot
 * be read out of the resource at all, which is invisible in development and
 * broken for every customer.
 *
 * `local` is the fallback, so the tab still works offline.
 */
export function useRemoteChangelog(resource: string, enabled = true) {
  return useQuery({
    queryKey: ['public-changelog', resource],
    enabled: enabled && !!resource,
    queryFn: async (): Promise<string | null> => {
      const res = await fetch(`${BASE}/changelogs/${resource}.md`, { cache: 'no-store' });
      // A script with no entry in the repo is not an error - it simply has no
      // remote copy, and the shipped one is used.
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      return text.trim() ? text : null;
    },
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    throwOnError: false,
  });
}

/**
 * Announcements this server should actually see.
 *
 * Filtered here rather than in the feed, because the feed is one public file
 * read by every server: it cannot know which scripts are installed or what
 * versions they are on. A `resource` an entry names must be running, and a
 * `minVersion` must be met.
 */
export function filterAnnouncements(
  entries: PublicInfo['announcements'],
  installed: Record<string, string>,
): DispatchEntry[] {
  return entries.filter((entry) => {
    if (entry.resource && !installed[entry.resource]) return false;
    if (entry.minVersion && entry.resource) {
      const have = installed[entry.resource];
      if (!have || compareVersions(have, entry.minVersion) < 0) return false;
    }
    return true;
  });
}

/** Scripts with a newer release than the one running. */
export function outdatedScripts(
  latest: Record<string, string>,
  installed: Record<string, string>,
): { resource: string; have: string; available: string }[] {
  const out: { resource: string; have: string; available: string }[] = [];
  for (const [resource, available] of Object.entries(latest)) {
    const have = installed[resource];
    if (!have) continue;
    if (compareVersions(available, have) > 0) out.push({ resource, have, available });
  }
  return out;
}
