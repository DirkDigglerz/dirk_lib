import { useMemo } from 'react';
import { effectiveValue, useStudio } from './store';
import type { SettingEntry } from './types';

/**
 * The logger's own settings, pulled out for the Delivery tab.
 *
 * They used to live in dirk_lib's settings rail under "Logger", which meant
 * leaving the page where you read logs to change where logs go. Delivery is
 * the page about exactly that, so it owns them - the same move already made
 * for `bridging` (Bridges page) and `access` (Admins page).
 *
 * The schema stays the source of truth. These are the SAME entries the rail
 * would have drawn, so they save through the same store, the same save bar and
 * the same history. Nothing here is a second copy of a setting.
 */
export function useLoggerSettings() {
  const scripts = useStudio((s) => s.scripts);
  // Subscribing to the draft keeps a staged edit visible immediately.
  const draft = useStudio((s) => s.draft.dirk_lib);

  return useMemo(() => {
    const lib = scripts.find((script) => script.shared);
    const entries = lib?.entries ?? [];
    const at = (path: string) => entries.find((entry) => entry.path === path);

    return {
      resource: lib?.resource ?? 'dirk_lib',
      /** the routes array - one row per Discord webhook */
      routes: at('logger.routes'),
      enabled: at('logger.local.enabled'),
      retentionDays: at('logger.local.retentionDays'),
      value: (entry?: SettingEntry) =>
        (entry && lib ? effectiveValue(lib.resource, entry) : undefined),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scripts, draft]);
}
