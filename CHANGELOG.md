# UPDATE 1.2.42 | 08/05/2026

### scriptConfig — permissions
- **Master-group convar takes a comma-separated list now.** Default `group.admin,admin,command` — whichever ACE your server.cfg actually grants, you'll match. Override `dirk_lib_master_group` with your own list (or single value) to lock it down. Avoids the long-running "I'm clearly admin but the editor says no permission" issue caused by every cfg granting different ACE values.
- **Save permission now matches the chooser-open permission.** Both go through the same authoritative `canEditScriptConfig` check (master ACE list + per-resource overrides). Before this, opens worked but saves silently failed with `NoPermission` for masters because the callback ran in the consumer's Lua VM and couldn't see the dirk_lib-internal access function.
- New export: **`exports.dirk_lib:canEditScriptConfig(src, resourceName)`** — bridges the cross-VM gap above. Any script consuming `lib.scriptConfig(...)` can also call this directly to check permission server-side.
- The `/dirk_config` chooser now logs (server-side) when a player is denied, including the master-group value it checked and the player's identifiers, so cfg mismatches are diagnosable instead of silent.

### scriptConfig — smartMerge
- **Fixed nested-array deletes silently coming back from defaults.** Inside an `x-arrayKey` array (e.g. `stores`), the matching of a default item with its DB version used `lib.table.merge`, whose third argument is `addDuplicateNumbers` — not the `overwrite` flag the calling code seemed to assume. The recursion into nested arrays merged by numeric index, so any indexes that existed in defaults but had been deleted in the DB came back on every load. Replaced with recursive `smartMerge`, which respects "DB is source of truth" for arrays.
- New helper `isArrayLike(t)` so smartMerge can correctly identify nested arrays even when no JSON-Schema item info is provided.

### Notes for consumers
- No API changes. Existing `lib.scriptConfig(schema, canEditFn, rules)` calls keep working — `canEditFn` becomes a fallback that runs only when the master/override check denies. Custom rules can grant additional access but cannot lock out the master.
