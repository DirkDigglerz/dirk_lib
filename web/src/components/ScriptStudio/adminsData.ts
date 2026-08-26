import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchNui, isEnvBrowser } from 'dirk-cfx-react';
import { MOCK_ACE_GRANTS, MOCK_ADMINS, MOCK_ONLINE, type AdminLevel } from './mockAdmins';
import { notify } from './Toasts';

/**
 * Who can open Script Studio.
 *
 * One row per subject, which is either a player (identifier) or an ACE
 * principal (group.mod). The page draws them as two lists because they are
 * managed differently, but they are the same rows and resolve by the same
 * rule: highest level wins, and an empty script list means every script.
 *
 * MASTER ONLY to change. `canManage` comes from the server, so the page can
 * render read-only rather than offering buttons that will be refused - and
 * the server refuses regardless of what the page decided.
 */

export type AdminKind = 'identifier' | 'principal';

export type AdminRow = {
  id: number;
  kind: AdminKind;
  /** absent for a non-master viewer, who is not shown identifiers */
  subject?: string;
  name?: string;
  level: AdminLevel;
  /** empty = every script */
  scripts: string[];
  addedBy?: string;
  addedAt?: number;
};

export type OnlineRow = {
  source: number;
  name: string;
  identifier: string;
  identifiers: string[];
  /** already has every script via the master group */
  master?: boolean;
};

export type AdminsState = {
  rows: AdminRow[];
  /** empty unless the viewer may manage - the picker is the only use for it */
  online: OnlineRow[];
  canManage: boolean;
  masterGroup: string;
  /** the value is the fallback, not something the server chose */
  masterGroupIsDefault?: boolean;
  masterGroupConvar?: string;
};

const EMPTY: AdminsState = { rows: [], online: [], canManage: false, masterGroup: '' };

async function ask<T>(callback: string, payload?: unknown): Promise<T> {
  const reply = await fetchNui<{ success: boolean; data?: T; _error?: string }>(callback, payload ?? {});
  if (!reply?.success) throw new Error(reply?._error ?? 'NoAnswer');
  return reply.data as T;
}

export function useAdmins() {
  return useQuery({
    queryKey: ['admins'],
    queryFn: async (): Promise<AdminsState> => {
      if (isEnvBrowser()) {
        return {
          rows: [
            ...MOCK_ACE_GRANTS.filter((g) => g.level !== 'none').map((g, i) => ({
              id: 1000 + i, kind: 'principal' as const, subject: g.principal,
              level: g.level as AdminLevel, scripts: [], addedBy: g.addedBy,
            })),
            ...MOCK_ADMINS.filter((a) => a.source === 'panel').map((a, i) => ({
              id: i + 1, kind: 'identifier' as const, subject: a.identifier,
              name: a.name, level: a.level, scripts: a.scripts, addedBy: a.addedBy,
            })),
          ],
          online: MOCK_ONLINE.map((p) => ({ ...p, identifiers: [p.identifier] })),
          canManage: true,
          masterGroup: 'group.admin',
          masterGroupIsDefault: true,
          masterGroupConvar: 'dirk_lib_master_group',
        };
      }
      return ask<AdminsState>('GET_ADMINS');
    },
    // Who has access changes when someone changes it, which is the mutation
    // below - so there is nothing to poll for.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: EMPTY,
  });
}

/** Why a write was refused, in words rather than a code. */
const FAILURES: Record<string, string> = {
  NotAuthorized: 'Only the master group can change who has access',
  NoSubject: 'That needs an identifier or a group name',
  BadLevel: 'Pick edit or view',
  QueryFailed: 'The database refused that - check the server console',
  NotOpen: 'The panel lost focus, try again',
};

function reason(err: unknown): string {
  const key = err instanceof Error ? err.message : String(err ?? '');
  return FAILURES[key] ?? 'That did not save';
}

export function useAdminMutations() {
  const qc = useQueryClient();
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admins'] }); };

  const put = useMutation({
    mutationFn: async (row: {
      kind: AdminKind; subject: string; name?: string;
      level: AdminLevel; scripts?: string[];
    }) => {
      if (isEnvBrowser()) return true;
      return ask<boolean>('PUT_ADMIN', row);
    },
    onSuccess: (_data, row) => {
      refresh();
      notify('success', `${row.name || row.subject} can now ${row.level === 'edit' ? 'edit' : 'view'}`);
    },
    onError: (err) => notify('error', reason(err)),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      if (isEnvBrowser()) return true;
      return ask<boolean>('REMOVE_ADMIN', { id });
    },
    onSuccess: () => {
      refresh();
      notify('success', 'Access revoked');
    },
    onError: (err) => notify('error', reason(err)),
  });

  return { put, remove };
}
