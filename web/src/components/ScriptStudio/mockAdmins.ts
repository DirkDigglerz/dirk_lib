// Who can open Script Studio, and what they may touch.
//
// Three sources, deliberately distinct because they behave differently:
//   ace     - granted by server.cfg, not editable from a UI
//   config  - a server-side file that survives updates and cannot be revoked
//             here, so there is always a way back in
//   panel   - the day-to-day list, stored in the database
//
// Identifiers are server-only: this payload only ever reaches an admin.

export type AdminLevel = 'edit' | 'view';
export type AdminSource = 'ace' | 'config' | 'panel';

export type AdminEntry = {
  id: string;
  name: string;
  identifier: string;
  source: AdminSource;
  level: AdminLevel;
  /** empty = every script */
  scripts: string[];
  addedBy?: string;
  addedAt?: string;
  online?: boolean;
};

export type OnlinePlayer = {
  source: number;
  name: string;
  identifier: string;
  /** already has access from somewhere */
  existing?: AdminSource;
};

/**
 * The ACE objects dirk_lib gates on. Access is checked with
 * IsPlayerAceAllowed, which resolves the whole tree - every exec'd cfg,
 * add_principal inheritance, and anything added at runtime - so checking is
 * complete no matter which file granted it.
 *
 * Listing is a different matter: FiveM has no native to enumerate principals,
 * so we cannot discover which groups exist. What we CAN do is test a named
 * principal with IsPrincipalAceAllowed, which is what these rows are.
 */
export const ACE_OBJECTS: { object: string; grants: string }[] = [
  { object: 'dirk.config', grants: 'Open and edit every script' },
  { object: 'dirk.config.view', grants: 'Open, but change nothing' },
];

export type AceGrantLevel = 'edit' | 'view' | 'none';

export type AceGrant = {
  /** the stored row, when this came from the database rather than a cfg */
  id?: number;
  principal: string;
  level: AceGrantLevel;
  /**
   * Granted straight in server.cfg (add_ace ... dirk.config). We can see it
   * with IsPrincipalAceAllowed but cannot take it away from here, so it shows
   * locked - same rule as the config-file identifiers.
   */
  fromCfg?: boolean;
  addedBy?: string;
};

/**
 * Stored by dirk_lib, not read from any cfg.
 *
 * On an access check the server walks these rows and tests each principal with
 * IsPlayerAceAllowed(src, principal) - highest level wins. That makes grants
 * persistent across restarts without writing ACEs (runtime add_ace does not
 * survive a restart) and without anyone editing server.cfg.
 */
export const MOCK_ACE_GRANTS: AceGrant[] = [
  { principal: 'group.admin', level: 'edit', fromCfg: true },
  { principal: 'group.mod', level: 'view', addedBy: 'Dirk' },
  { principal: 'group.headadmin', level: 'edit', addedBy: 'Dirk' },
  { principal: 'group.support', level: 'none', addedBy: 'Kayla' },
];

export const MOCK_ADMINS: AdminEntry[] = [
  {
    id: 'cfg-1', name: 'Dirk', identifier: 'license2:9a1b4c7e2f',
    source: 'config', level: 'edit', scripts: [],
    addedBy: 'server_config.lua', online: true,
  },
  {
    id: 'db-1', name: 'Kayla', identifier: 'license2:44de91b0aa',
    source: 'panel', level: 'edit', scripts: ['dirk_fishing'],
    addedBy: 'Dirk', addedAt: '2026-08-14', online: true,
  },
  {
    id: 'db-2', name: 'Marcus', identifier: 'license2:7f20cc83e1',
    source: 'panel', level: 'view', scripts: [],
    addedBy: 'Dirk', addedAt: '2026-08-02', online: false,
  },
  {
    id: 'db-3', name: 'Sam', identifier: 'license2:1cc409ba55',
    source: 'panel', level: 'edit', scripts: ['dirk_fishing', 'dirk_lib'],
    addedBy: 'Kayla', addedAt: '2026-07-28', online: false,
  },
];

export const MOCK_ONLINE: OnlinePlayer[] = [
  { source: 2, name: 'Dirk', identifier: 'license2:9a1b4c7e2f', existing: 'config' },
  { source: 14, name: 'Kayla', identifier: 'license2:44de91b0aa', existing: 'panel' },
  { source: 31, name: 'Jordan Reyes', identifier: 'license2:ab77e0c412' },
  { source: 44, name: 'Priya Nair', identifier: 'license2:c0de41b9a7' },
  { source: 57, name: 'Tom Whitfield', identifier: 'license2:5e91aa3d80' },
];
