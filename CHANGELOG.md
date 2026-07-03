# UPDATE 1.2.65 | 03/07/2026

Inventory-bridge fixes for tgiann, a new devix_inventory bridge, and a Traditional Chinese locale.

## Fixes
- **tgiann-inventory: usable items (e.g. fishing rods) now fire.** On inventories layered over ESX that don't hand ESX an item record, a used item arrived without its data and the use was silently skipped — so the item appeared to "do nothing". The ESX bridge now resolves the missing record through the active inventory bridge instead of bailing, so the use goes through. Kept generic — no hardcoded inventory in the framework layer.

## New
- **devix_inventory bridge.** Initial compatibility layer for devix_inventory (grid-based). Handles add/remove/read, resolves grid slots, and writes item metadata through devix's serial-keyed update path. devix is closed-source, so a couple of record-shape details still need confirming on a live install — treat this first pass accordingly.
- **Traditional Chinese (zh-TW) locale.**

---

# UPDATE 1.2.63 | 26/06/2026

Logging backends beyond Discord, per-resource access control, and a lighter config panel.

### New features
- **Send logs to Grafana, Datadog or Fivemanage.** A new Logger tab in `/dirk_config` lets you pick a logging service (Loki / Grafana, Datadog or Fivemanage); any dirk script that logs — fishing included — then routes through it. Discord webhooks still work exactly as before, this sits alongside them. Service credentials are server-only and never sent to clients.
- **Per-resource access control.** Each script — and dirk_lib itself — now has its own Access tab controlling who, beyond server admins, can open and edit its live config, granted by job / gang / ACE group or by individual player. The old central override list has been removed in favour of this. Master admins (the `dirk_lib_master_group` convar, default `group.admin`) always have access and can't be locked out.

### Improvements
- **The Appearance tab is now "Theme"** — same settings, clearer name (matches the per-script theme tabs).
- **Lighter config-panel load.** The panel now hydrates from a single cached fetch handed to the interface, and admins pull only the server-only fields when they actually open it — less network traffic, and secrets never leave the server.
- **English fallback for untranslated strings.** A config label with no translation in the active language now falls back to English instead of showing the raw key.

---

# UPDATE 1.2.62 | 25/06/2026

### Fixes
- **Destroyed ped handles are never served from cache.** A cached ped handle is now validated before reuse, preventing a class of nil-ped errors after respawns or model swaps.

---

# UPDATE 1.2.61 | 24/06/2026

### Fixes
- **core_inventory: item images + fitted rod parts fixed.** The image path for core_inventory is now detected correctly (shop and loadout icons were blank) and item metadata is read from the right place client-side, so fitted rod parts (reel / line / hook) save properly. Any dirk script running on core_inventory benefits.

---

# UPDATE 1.2.60 | 23/06/2026

### Fixes
- **Framework bridge player accessors now fail safe.** `lib.player.identifier` / `.name` / `.gender` / `.phoneNumber` (and the other player getters) used to `assert` "Player does not exist" the moment they were called for a connecting / not-yet-loaded source. If that landed in a server callback during early join, the throw left the client's `lib.callback.await` hanging — which on some setups blocked op-multicharacter (new players couldn't create a character) and could crash an admin panel mid-join. They now return `nil` and let the caller degrade gracefully. Applied across the **qb-core, qbx_core and es_extended** bridges. **Any dirk script benefits — updating is recommended.**

- **ESX + tgiann-inventory: using a fishing rod (or any usable item) no longer throws a server error.** When tgiann fires a use event without an ESX-shaped item record, the bridge now bails gracefully (with a warning) instead of handing `nil` to the consumer.
- **qb-inventory: item metadata now persists per slot.** The bridge had no per-slot `setMetadata` (writes fell through to *player* metadata) and read item metadata from the wrong field — so fitted rod parts (reel/line/hook) silently failed to save. Both fixed; any dirk script storing item metadata on qb-inventory benefits.
- **`formatImagePath` no longer errors on a nameless item.** A nil/empty item name (e.g. surfacing in a FETCH_ALL_ITEMS lookup) now returns safely instead of crashing the item-list load.

---

# UPDATE 1.2.59 | 21/06/2026

### New inventory support — one_inventory
- **one_inventory (OneStudios) is now a supported inventory.** It's autodetected like every other system — no config needed — or you can pick it explicitly under Bridging in `/dirk_lib`. Item give/remove, stacking with metadata, slot lookups, item images, and per-slot metadata writes all work through it, so any dirk script that uses the inventory bridge (fishing included) runs on one_inventory out of the box.
- Usable items keep working via your framework's normal registration, and the item image path is detected automatically (override it under Bridging if you serve images from a CDN).

---

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
