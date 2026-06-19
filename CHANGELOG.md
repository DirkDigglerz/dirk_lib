# UPDATE 1.2.58 | 19/06/2026

Config menu cleanup, a complete Spanish translation, and the diagnostics layer is now opt-in.

### Config menu — new "Basic" tab
- **Server name, language, currency, and a debug toggle now live in one "Basic" tab** at the top of `/dirk_lib`, replacing the separate Branding and Localization tabs. Existing values carry over automatically on first boot — nothing to re-enter.
- **Advanced** now holds just the primary-identifier setting.
- The inventory image path stays under Bridging (next to the inventory picker), and a custom URL there now properly overrides the auto-detected one.

### Diagnostics are now opt-in
- **The SQL/hitch diagnostics layer only runs when you enable Basic → Debug** (off by default). It was previously always-on; now it's zero-overhead unless you flip the toggle to capture a report.

### Discord settings page
- Bigger, easier show/hide toggle on the bot-token field, with proper spacing from the edge.
- The "how to create a bot" guide is shown inline instead of behind a dropdown, and the developer-portal link is more readable.

### Localization
- **Spanish (es) is now fully translated** — a large batch of strings that previously fell back to English have been completed.
- The config menu's left-hand tab labels now update instantly when you switch language (no restart needed).

### Under the hood (recent)
- Lighter startup: the script-config system skips its boot-time database write on a clean restart, and the shared config table is schema-checked once per boot instead of by every dirk resource.

---

# UPDATE 1.2.47 | 12/05/2026

### Hotfix — ox_inventory bridge `getItems` cleanup
- 1.2.46 swapped to `GetInventory(invId, true)`, but ox_inventory's second arg is `owner` (string|number), not a `full` flag — passing `true` is undefined on modern ox. Dropped the second arg. Items still come back the same way via `.items` on the returned OxInventory object. Strictly broader compatibility.

---

# UPDATE 1.2.46 | 12/05/2026

### Hotfix — ox_inventory bridge: wrong export name
- `lib.inventory.getItems(invId)` was calling `exports.ox_inventory:GetInventoryItems(invId)`. The export exists on modern ox_inventory, but ox-compatible inventories that re-declare `provides 'ox_inventory'` (e.g. ak47_inventory) emulate an older snapshot of the API and don't ship it — calling it there crashes with `No such export GetInventoryItems in resource ox_inventory`. Switched to `GetInventory(invId)` which has been in ox's API since day one and works on every version + emulation. Affects everywhere `lib.inventory.getItems` is used (fish markets, equipment stores, loadout, bait market, reward backfill).

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
