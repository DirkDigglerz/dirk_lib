// Stand-in for the change log the server already keeps. The shape is exactly
// dirk-cfx-react's ScriptConfigHistoryEntry, so wiring the real callback later
// is a data swap, not a UI change.
//
// Timestamps are fixed rather than relative to "now" so the mock renders the
// same on every load and is easy to talk about.

export type HistoryChange = { path: string; old: unknown; new: unknown };

export type HistoryEntry = {
  at_unix: number;
  at_utc: string;
  script: string;
  admin?: { source?: number; name?: string; identifier?: string };
  expected_version?: number;
  applied_version?: number;
  changes: HistoryChange[];
};

const LIAM = { source: 2, name: 'Dirk', identifier: 'license2:9a1b4c7e2f' };
const MOD = { source: 14, name: 'Kayla (mod)', identifier: 'license2:44de91b0aa' };
const CONSOLE = { name: 'console' };

export const MOCK_HISTORY: Record<string, HistoryEntry[]> = {
  dirk_fishing: [
    {
      at_unix: 1755599400, at_utc: '2026-08-19 09:10:00', script: 'dirk_fishing',
      admin: LIAM, expected_version: 41, applied_version: 42,
      changes: [
        { path: 'basic.spookPerCatch', old: 5, new: 8 },
        { path: 'basic.debug', old: false, new: true },
      ],
    },
    {
      at_unix: 1755585600, at_utc: '2026-08-19 05:20:00', script: 'dirk_fishing',
      admin: MOD, expected_version: 40, applied_version: 41,
      changes: [
        { path: 'theme.primaryColor', old: '#5FD08A', new: '#4CC3DE' },
        { path: 'theme.useOverride', old: false, new: true },
      ],
    },
    {
      at_unix: 1755512700, at_utc: '2026-08-18 09:05:00', script: 'dirk_fishing',
      admin: LIAM, expected_version: 39, applied_version: 40,
      changes: [
        { path: 'equipment.rods', old: '13 entries', new: '14 entries' },
      ],
    },
    {
      at_unix: 1755426300, at_utc: '2026-08-17 09:05:00', script: 'dirk_fishing',
      admin: MOD, expected_version: 38, applied_version: 39,
      changes: [
        { path: 'basic.permitPrice', old: 2500, new: 4000 },
        { path: 'basic.replacePermitPrice', old: 500, new: 900 },
        { path: 'basic.permitInterval', old: 7, new: 14 },
      ],
    },
    {
      at_unix: 1755340000, at_utc: '2026-08-16 09:06:40', script: 'dirk_fishing',
      admin: CONSOLE, expected_version: 37, applied_version: 38,
      changes: [
        { path: 'logging.webhookUrl', old: '', new: '(server only - hidden)' },
      ],
    },
    {
      at_unix: 1755253600, at_utc: '2026-08-15 09:06:40', script: 'dirk_fishing',
      admin: LIAM, expected_version: 36, applied_version: 37,
      changes: [
        { path: 'zones', old: '2 entries', new: '3 entries' },
        { path: 'basic.maxTrapsPerPlayer', old: 4, new: 6 },
      ],
    },
  ],
  dirk_lib: [
    {
      at_unix: 1755596000, at_utc: '2026-08-19 08:13:20', script: 'dirk_lib',
      admin: LIAM, expected_version: 12, applied_version: 13,
      changes: [{ path: 'bridging.inventory', old: 'auto', new: 'ox_inventory' }],
    },
    {
      at_unix: 1755166000, at_utc: '2026-08-14 08:46:40', script: 'dirk_lib',
      admin: LIAM, expected_version: 11, applied_version: 12,
      changes: [{ path: 'appearance.primaryColor', old: '#4CC3DE', new: '#5FD08A' }],
    },
  ],
};
