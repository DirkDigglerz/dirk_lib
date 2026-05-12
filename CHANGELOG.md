# UPDATE 1.2.46 | 12/05/2026

### Hotfix — ox_inventory bridge: wrong export name
- `lib.inventory.getItems(invId)` on the ox_inventory bridge was calling a non-existent `exports.ox_inventory:GetInventoryItems` — it crashed with `No such export GetInventoryItems in resource ox_inventory` on every store/loadout/market lookup. Now uses the correct `GetInventory(invId, true)` and returns its `.items` table. Affects everywhere `lib.inventory.getItems` is used (fish markets, equipment stores, loadout, bait market, reward backfill).

---

# UPDATE 1.2.45 | 12/05/2026

### Hotfix — configurator crash on malformed inventory items
- `lib.formatImagePath` now safely returns `""` when called with `nil`/empty/non-string input, instead of crashing with `attempt to index a nil value (local 'name')`. The configurator could fail to open on servers whose inventory had at least one item registered without a `name` field — a custom or malformed entry was enough to break the whole items lookup.
- ox_inventory bridge: `items()` and `item()` now fall back to the item's table key when both `client.image` and `name` are missing, matching the defensive `or k`/`or name` pattern the other bridges already had.

---

# UPDATE 1.2.43 | 11/05/2026

Lib-side fixes from the dirk_fishing customer-ticket batch (jamazzz, jahm94, battlex2307), plus a new schema-driven install + missing-items pipeline. Pairs with dirk_fishing 2.0.26.

### Schema-driven install generation
- New `x-installItem` / `x-installItemList` schema annotations describe items the consumer needs registered. dirk_lib walks them after every scriptConfig load + change and writes `INSTALLATION/itemsToAdd/{ox.lua, qb.lua, esx.sql}` straight to the consumer's resource folder. Replaces hand-rolled per-resource install.lua files.
- ESX SQL output now matches the actual ESX legacy `items` table (`name, label, weight`) — the previous hand-rolled SQL declared a non-existent `description` column and would fail to import on some servers.

### Missing-items audit + banner
- New per-resource callback returns a list of items that are configured but not registered in the player's inventory, with ready-to-paste snippets for ox / qb / esx.
- Server console warning fires once on resource start (deferred 5s for inventory-bridge readiness): "N items missing from your inventory: …". Caps at 5 names + "and N more". Silent when nothing's missing.
- A missing-items banner auto-appears in the configurator above the tab list whenever items are missing — no consumer code required, just annotate the schema. Includes a refresh button; re-audits on save-success.

### Inventory lookups
- New `lib.inventory.item(name)` accessor — works on every inventory bridge.
- Audited every underlying inventory's actual exports. Native single-item fast-paths now wired for `ox_inventory`, `tgiann-inventory`, `ak47_inventory` and `dirk_inventory`. `qs-inventory` and `codem-inventory` have no native definition lookup, so they fall back to a cached-bulk read.
- Framework-level fast-paths added too: `qb-core`, `qbx_core` and `es_extended` now do direct shared-table indexing, skipping the bulk-fetch cache build entirely.
- Fixed an edge case where an inventory's own items table (e.g. qs-inventory's `shared/items.lua`) was being shadowed by the framework's. Resolution chain now uses the inventory's own table when it has one, before falling back to the framework's. No more "item exists in the inventory but the lookup says it doesn't".

### ESX bridge
- `getMoney` now nil-checks the account — returns 0 instead of crashing on `.money`-of-nil when an account is missing. (This was the source of battlex2307's permit-purchase crash on first install.)
- New `cash` ↔ `money` alias resolver shared across `getMoney` / `addMoney` / `removeMoney` / `setMoney`. If you ask for `cash` and the player only has `money` (or vice versa), the bridge resolves to whichever the player actually has — cross-framework consumers don't need to special-case ESX legacy's account naming.

### Security
- `schema.json` removed from `dirk_lib/fxmanifest.lua`'s `files{}` block. It was reachable via `nui://dirk_lib/schema.json` from any iframe. Server-side `LoadResourceFile` reads don't need that exposure — only NUI / asset manifests do.

### scriptConfig
- `<scriptName>:giveScriptConfigItem` callback now accepts an optional `metadata` payload that's passed through to `addItem`. Lets consumers include real catch metadata on items the admin spawns from the configurator, so the spawned item behaves identically to one earned naturally. Optional — no breaking change.

### Release pipeline
- Released zip now includes `schema.json`. The release workflow's bundled-files copy was missing it, so FiveM warned `could not find file 'schema.json'` on first boot for installs from the GitHub release (self-built copies were always fine).

---

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
