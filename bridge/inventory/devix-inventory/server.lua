local DEVIX = 'devix-inventory'
local DEVIX_CORE = 'devix-core'
local cachedItems

-- devix-core exposes the runtime usable-item registrar (UsableItem) on the table
-- returned by getObjects(). Resolve it lazily + once (false = unavailable, so we
-- don't re-pcall every registration). Used by bridge.useableItem below.
local devixCore
local function getDevixCore()
  if devixCore == nil then
    local ok, obj = pcall(function() return exports[DEVIX_CORE]:getObjects() end)
    devixCore = (ok and type(obj) == 'table' and obj) or false
  end
  return devixCore or nil
end

-- devix-core hands its whole API across the resource boundary as CALLABLE TABLES
-- (FiveM reference-function wrappers carrying __call/__pack/__unpack), NOT raw
-- functions. So `type(x) == 'function'` is false for EVERY entry, which silently
-- disabled usable-item registration: the fishing rod and guidebook did nothing on
-- use, with no console error, because the guard bailed before registering
-- (reported by _i23). Verified against a live devix install — getObjects()
-- returns 50 entries, all tables, every one with a working __call. So test for
-- CALLABILITY, never the type.
local function isCallable(v)
  if type(v) == 'function' then return true end
  if type(v) ~= 'table' then return false end
  local mt = getmetatable(v)
  return mt ~= nil and rawget(mt, '__call') ~= nil
end

-- devix stores per-item metadata under `info` (qb-core convention) and quantity
-- under `amount`. dirk_lib's contract is that every item exposes `.metadata`,
-- `.count` and `.slot`. We normalise on the way out: mirror `info`→`metadata`,
-- `amount`→`count`, and stamp the slot key onto the item. This is the same class
-- of fix that made grid inventories (core_inventory) work with the fishing-rod
-- loadout, which finds an item by `.slot` and reads its `.metadata` directly.
local function normaliseItem(it, slot)
  if type(it) ~= 'table' then return it end
  if slot ~= nil then it.slot = it.slot or slot end
  if it.metadata == nil then it.metadata = it.info or {} end
  if it.count == nil then it.count = it.amount end
  return it
end

local function normalise(items)
  if type(items) ~= 'table' then return {} end
  for key, it in pairs(items) do
    normaliseItem(it, key)
  end
  return items
end

-- devix splits operations between player inventories (number src) and stash
-- inventories (string id). All bridge functions accept either; route on type.
local function isStash(invId)
  return type(invId) ~= 'number' and not tonumber(invId)
end

-- Stash config registered ahead of time so the client open handler can pass the
-- right label/type. Populated by registerStash.
local stashes = {}

-- Client openStash → here (mirrors core_inventory's server-side open pattern).
-- UNCONFIRMED: exact server open signature. devix lists OpenStashInventory
-- (Grid & Stash) and OpenInventoryById (UI & Display). OpenStashInventory(src, id)
-- is the best-effort guess — confirm with _i23.
RegisterNetEvent(('%s:openInventory'):format(cache.resource), function(invId, data)
  local src = source
  local cfg = stashes[invId] or data or {}
  exports[DEVIX]:OpenStashInventory(src, invId, cfg)
end)

local bridge
bridge = {

  --- Add Item to inventory either playerid or invId.
  --- Player: AddItem(source, item, amount, slot, info, reason).
  --- Stash:  AddItemStash(stashId, item, amount, info)  (no slot arg documented).
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param md table [Optional] Item Metadata
  ---@param slot number [Optional] Item Slot
  ---@return boolean
  addItem = function(invId, item, count, md, slot)
    count = count or 1
    if isStash(invId) then
      return exports[DEVIX]:AddItemStash(invId, item, count, md)
    end
    return exports[DEVIX]:AddItem(invId, item, count, slot, md, 'dirk_lib')
  end,

  --- Remove Item from inventory either playerid or invId.
  --- Player: RemoveItem(source, item, amount, slot, reason) — NO metadata param
  ---   in devix docs, so `md` is ignored on the player path.
  --- Stash:  RemoveItemStash(stashId, item, amount, ...) — UNCONFIRMED signature,
  ---   mirrored best-effort against AddItemStash.
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param md table [Optional] Item Metadata (unsupported on player path by devix)
  ---@param slot number [Optional] Item Slot
  ---@return boolean
  removeItem = function(invId, item, count, md, slot)
    count = count or 1
    if isStash(invId) then
      return exports[DEVIX]:RemoveItemStash(invId, item, count, md)
    end
    return exports[DEVIX]:RemoveItem(invId, item, count, slot, 'dirk_lib')
  end,

  --- Check if player/inventory has item. Returns the count when present (the
  --- interface treats a number as truthy), false otherwise.
  --- Fast path uses GetItemCount(source, item) — but that export does NOT filter
  --- on metadata or slot, so any md/slot filter walks the normalised snapshot.
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param md table [Optional] Item Metadata
  ---@param slot number [Optional] Item Slot
  ---@return number | boolean  false when not present, count (number) when present
  hasItem = function(invId, item, count, md, slot)
    count = count or 1

    -- md/slot filter, or any stash lookup → walk the snapshot.
    if md or slot or isStash(invId) then
      local total = 0
      for _, v in pairs(bridge.getItems(invId)) do
        if v.name == item
          and (not slot or v.slot == slot)
          and (not md or lib.table.compare(v.metadata, md)) then
          total += (v.count or v.amount or 0)
        end
      end
      return total >= count and total or false
    end

    local have = exports[DEVIX]:GetItemCount(invId, item) or 0
    return have >= count and have or false
  end,

  --- Slot-indexed snapshot of every item in the inventory (player or stash),
  --- normalised to carry .slot / .metadata / .count.
  getItems = function(invId)
    if isStash(invId) then
      return normalise(exports[DEVIX]:GetStashItems(invId) or {})
    end
    return normalise(exports[DEVIX]:GetInventory(invId) or {})
  end,

  --- Single slot lookup.
  getItemBySlot = function(invId, slot)
    if isStash(invId) then
      -- No per-slot stash export; walk the snapshot.
      for _, v in pairs(bridge.getItems(invId)) do
        if v.slot == slot then return v end
      end
      return nil
    end
    local it = exports[DEVIX]:GetItemBySlot(invId, slot)
    if not it or not it.name then return nil end
    return normaliseItem(it, slot)
  end,

  --- First matching slot for an item (optional metadata filter). devix's native
  --- GetItemByName does NOT filter on metadata, so a md filter walks the snapshot.
  getItemByName = function(invId, item, md)
    if isStash(invId) or md then
      for _, v in pairs(bridge.getItems(invId)) do
        if v.name == item and (not md or lib.table.compare(v.metadata, md)) then
          return v
        end
      end
      return nil
    end
    local it = exports[DEVIX]:GetItemByName(invId, item)
    if not it or not it.name then return nil end
    return normaliseItem(it)
  end,

  --- Same as getItemByName but with metadata required.
  getItemByMetadata = function(invId, item, md)
    return bridge.getItemByName(invId, item, md)
  end,

  --- Register a usable item. devix-core has a runtime registrar, `UsableItem`
  --- (from `exports['devix-core']:getObjects()`), which devix-inventory invokes
  --- on use and hands `(source, itemData)` where itemData carries the **slot** +
  --- **info/metadata** of the exact stack used. We register through it directly
  --- rather than relying on the framework CreateUseableItem sync — that path
  --- didn't reliably carry the slot, so consumers (dirk_fishing's rod) errored
  --- with "cannot find slot on use" (reported by _i23). We normalise the payload
  --- so the callback receives .slot/.metadata/.count like every other bridge.
  useableItem = function(itemName, callback)
    local core = getDevixCore()
    if not core or not isCallable(core.UsableItem) then
      lib.print.warn(('devix bridge: devix-core UsableItem unavailable — usable item %s not registered'):format(tostring(itemName)))
      return
    end
    local ok, err = pcall(core.UsableItem, itemName, function(source, itemData)
      callback(source, normaliseItem(itemData or {}, itemData and itemData.slot))
    end)
    if not ok then
      lib.print.warn(('devix bridge: registering usable item %s failed — %s'):format(tostring(itemName), tostring(err)))
    end
  end,

  --- Set metadata of an item at a specific slot.
  --- devix has NO ox-style SetMetadata(slot, meta). Metadata writes go through
  --- UpdateItemInfoBySerie(source, invType, itemName, serie, newInfo), keyed by
  --- the item's unique `serie` serial. Resolve the serie from the slot item,
  --- then push the new info (full-replace).
  ---@param invId number Player ID (stash setMetadata is unsupported)
  ---@param slot number
  ---@param metadata table
  ---@return boolean
  setMetadata = function(invId, slot, metadata)
    if isStash(invId) then
      lib.print.warn('devix bridge: setMetadata on stash inventories is not supported')
      return false
    end
    -- devix exposes a direct slot-keyed metadata writer (confirmed in its docs):
    --   UpdateSlotMetadata(source, slot, newInfo) — full-replace of the slot's
    --   `info`, matching ox SetMetadata semantics.
    -- The previous serie-based path only worked for WEAPONS — regular items like
    -- the fishing rod carry no serie, so their metadata (e.g. attachments) never
    -- saved on devix (reported by _i23). Slot works for every item type.
    return exports[DEVIX]:UpdateSlotMetadata(invId, slot, metadata or {}) and true or false
  end,

  --- editMetadata is an alias for setMetadata (same slot-targeted write).
  editMetadata = function(invId, slot, metadata)
    return bridge.setMetadata(invId, slot, metadata)
  end,

  --- Clear every item from the inventory.
  ---@param invId string | number
  ---@param filterItems? string | table
  clearInventory = function(invId, filterItems)
    if isStash(invId) then
      -- No documented stash-clear export; remove each item individually.
      -- UNCONFIRMED RemoveItemStash signature (see removeItem).
      for _, v in pairs(bridge.getItems(invId)) do
        exports[DEVIX]:RemoveItemStash(invId, v.name, v.count or v.amount or 1)
      end
      return true
    end
    return exports[DEVIX]:ClearInventory(invId, filterItems)
  end,

  --- Some consumers call lib.inventory.get; same shape as getItems.
  get = function(invId)
    return bridge.getItems(invId)
  end,

  --- Display name for an item id (server-side item definition).
  getItemLabel = function(item)
    local def = exports[DEVIX]:GetSharedItemInfo(item)
    return (def and def.label) or false
  end,

  --- Can the player carry `count` more of `item`?
  canCarryItem = function(invId, item, count)
    if isStash(invId) then return true end -- no stash-space check documented
    return exports[DEVIX]:CanCarryItem(invId, item, count or 1)
  end,

  --- Register a stash. devix signature is positional:
  --- RegisterStash(id, label, slots, weight, owner, groups, coords). We also
  --- remember the config so the client open handler has the label/type.
  registerStash = function(id, data)
    data = data or {}
    stashes[id] = data
    return exports[DEVIX]:RegisterStash(
      id,
      data.label,
      data.maxSlots,
      data.maxWeight,
      data.owner,
      data.groups,
      data.coords
    )
  end,

  --- Single-item lookup, returns the normalised record (matching `items()`
  --- shape) or nil if the item isn't registered.
  ---@param name string
  ---@return { name: string, label: string, weight: number, image: string }?
  item = function(name)
    if type(name) ~= 'string' or name == '' then return nil end
    local raw = exports[DEVIX]:GetSharedItemInfo(name)
    if not raw then return nil end
    return {
      name   = raw.name or name,
      label  = raw.label or raw.name or name,
      weight = raw.weight or 0,
      image  = lib.formatImagePath(raw.image or raw.name or name),
    }
  end,

  --- All registered items, keyed by name. Cached; invalidated whenever
  --- branding.itemImgPath changes so an admin CDN URL set via /dirk_config
  --- doesn't get masked by URLs baked from the boot-time autodetect default.
  ---@return table<string, { name: string, label: string, weight: number, image: string }>
  items = function()
    if cachedItems then return cachedItems end
    local all = exports[DEVIX]:GetItemList()
    if not all then return {} end
    local out = {}
    for k, v in pairs(all) do
      out[k] = {
        name   = v.name or k,
        label  = v.label or v.name or k,
        weight = v.weight or 0,
        image  = lib.formatImagePath(v.image or v.name or k),
      }
    end
    cachedItems = out
    return out
  end,
}

if lib.onSettings then
  lib.onSettings('itemImgPath', function() cachedItems = nil end)
end

return bridge
