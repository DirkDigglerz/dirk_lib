local INV = 'one_inventory'
local cachedItems

-- Forward-declared so the table's methods can reference `bridge` (e.g.
-- get → bridge.getItems). With `local bridge = {...}` the local isn't in
-- scope inside its own initializer, so the self-references would resolve to
-- a nil global.
local bridge

-- one_inventory is its own ox-flavoured inventory (it does NOT `provide
-- 'ox_inventory'`). Item entries it returns already carry a native
-- `.metadata` field — unlike qb-derived inventories that store it under
-- `info` — so no normalisation pass is needed here. invId may be a player
-- src (number) or any inventory id (string, e.g. stash/glovebox/trunk);
-- one_inventory's exports accept both, so we pass it straight through.

bridge = {
  --- Add Item to inventory either playerid or invId
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param md table [Optional] Item Metadata
  ---@param slot number [Optional] Item Slot
  ---@return boolean
  addItem = function(invId, item, count, md, slot)
    return exports[INV]:AddItem(invId, item, count or 1, md, slot)
  end,

  --- Remove Item from inventory either playerid or invId
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param md table [Optional] Item Metadata
  ---@param slot number [Optional] Item Slot
  ---@return boolean
  removeItem = function(invId, item, count, md, slot)
    return exports[INV]:RemoveItem(invId, item, count or 1, md, slot)
  end,

  --- Check if player has item in inventory
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param md table [Optional] Item Metadata
  ---@param slot number [Optional] Item Slot
  ---@return nil | number | boolean Returns the held count when present, false otherwise
  hasItem = function(invId, item, count, md, slot)
    count = count or 1

    if slot then
      local slotItem = exports[INV]:GetSlot(invId, slot)
      if not slotItem then return false end
      if slotItem.name ~= item then return false, 'not_right_name' end
      if md then
        local meta = slotItem.metadata or {}
        for k, v in pairs(md) do
          if meta[k] ~= v then return false, 'metadata_mismatch' end
        end
      end
      if (slotItem.count or 0) < count then return false, 'wrong_count' end
      return slotItem.count
    end

    -- GetItemCount sums every matching stack (optionally metadata-filtered).
    local total = exports[INV]:GetItemCount(invId, item, md)
    if not total or total == 0 then return false end
    return total >= count and total or false
  end,

  --- Slot-indexed snapshot of every item in the inventory (player or stash).
  --- Items carry native `.name/.count/.slot/.metadata`.
  getItems = function(invId)
    return exports[INV]:GetInventoryItems(invId) or {}
  end,

  --- Single slot lookup.
  getItemBySlot = function(invId, slot)
    return exports[INV]:GetSlot(invId, slot)
  end,

  --- First matching slot for an item (optional metadata filter).
  --- Returns { name, slot, count, metadata } or nil.
  getItemByName = function(invId, item, md)
    return exports[INV]:GetItem(invId, item, md)
  end,

  --- Same as getItemByName but with metadata required.
  getItemByMetadata = function(invId, item, md)
    return bridge.getItemByName(invId, item, md)
  end,

  --- Some consumers call lib.inventory.get; same shape as getItems.
  get = function(invId)
    return bridge.getItems(invId)
  end,

  --- Set metadata of an item at a specific slot. Load-bearing for the fishing
  --- rod, whose reel/line/hook parts and bait count live in the rod item's
  --- metadata — these writes must persist or parts vanish on re-read.
  ---@param invId number|string
  ---@param slot number
  ---@param metadata table
  ---@return boolean
  setMetadata = function(invId, slot, metadata)
    return exports[INV]:SetItemMetadata(invId, slot, metadata)
  end,

  --- editMetadata is the older alias for setMetadata.
  editMetadata = function(invId, slot, metadata)
    return bridge.setMetadata(invId, slot, metadata)
  end,

  --- Can the player carry `count` more of `item`?
  canCarryItem = function(invId, item, count)
    return exports[INV]:CanCarryItem(invId, item, count or 1)
  end,

  --- Clear every item from the inventory. `filterItems` maps to one_inventory's
  --- `keep` arg (items to retain).
  clearInventory = function(invId, filterItems)
    return exports[INV]:ClearInventory(invId, filterItems)
  end,

  --- Display name for an item id.
  getItemLabel = function(item)
    local def = exports[INV]:GetItemDefinition(item)
    return def and def.label or false
  end,

  --- one_inventory has no RegisterStash export — stashes are created on demand
  --- the first time they're opened (client OpenInventory 'stash'), so there's
  --- nothing to pre-register. Returns true so callers treat it as a success.
  registerStash = function(id, data)
    return true, 'one_inventory_creates_stashes_on_open'
  end,

  --- Single-item lookup. Returns the normalised record (matching `items()`
  --- shape) or nil if the item isn't registered.
  ---@param name string
  ---@return { name: string, label: string, weight: number, image: string }?
  item = function(name)
    if type(name) ~= 'string' or name == '' then return nil end
    local raw = exports[INV]:GetItemDefinition(name)
    if not raw then return nil end
    local img = (raw.client and raw.client.image) or raw.image or raw.name or name
    return {
      name   = raw.name or name,
      label  = raw.label or raw.name or name,
      weight = raw.weight or 0,
      image  = lib.formatImagePath(img),
    }
  end,

  --- All registered items, keyed by name. Cached; invalidated whenever
  --- branding.itemImgPath changes so an admin CDN URL set via /dirk_config
  --- doesn't get masked by URLs baked from the boot-time autodetect default.
  ---@return table<string, { name: string, label: string, weight: number, image: string }>
  items = function()
    if cachedItems then return cachedItems end
    local allItems = exports[INV]:GetAllItemDefinitions()
    if not allItems then return {} end
    local formatted = {}
    for k, v in pairs(allItems) do
      local img = (v.client and v.client.image) or v.image or v.name or k
      formatted[k] = {
        name   = v.name or k,
        label  = v.label or v.name or k,
        weight = v.weight or 0,
        image  = lib.formatImagePath(img),
      }
    end
    cachedItems = formatted
    return formatted
  end,

  -- NOTE: useableItem is intentionally omitted. one_inventory routes usable
  -- items through the framework-native registry (ESX.RegisterUsableItem /
  -- QBCore.Functions.CreateUseableItem), so lib.inventory.useableItem falls
  -- back to the framework bridge, which already wires those up correctly.
}

if lib.onSettings then
  lib.onSettings('itemImgPath', function() cachedItems = nil end)
end

return bridge
