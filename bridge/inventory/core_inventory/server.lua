local cachedItems

-- Stash config registered ahead of time so the open handler can pass the right
-- label/type. core_inventory has no registerStash export — stashes are created
-- on-demand by openInventory — so we just remember the config here.
local stashes = {}

-- Client openStash → here. core_inventory opens a stash via the server export
-- openInventory(source, invId, type, label, restrictedTo, openForSource).
RegisterNetEvent(('%s:openInventory'):format(cache.resource), function(invId, data)
  local src = source
  local cfg = stashes[invId] or data or {}
  exports['core_inventory']:openInventory(src, invId, cfg.invType or cfg.type or 'stash', cfg.label, nil, true)
end)

-- Declared then assigned so the table's own functions can self-reference
-- (e.g. getItemByMetadata → getItemByName). With `local bridge = {...}` the
-- local isn't in scope inside its own initializer.
local bridge
bridge = {

  --- Add Item to inventory either playerid or invId. core resolves a player
  --- source to `content-{citizenid}`; a string invId is used as the inventory
  --- name. core's addItem has no slot arg, so `slot` is ignored.
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param md table [Optional] Item Metadata
  ---@param slot number [Optional] Item Slot (unsupported by core_inventory)
  ---@return boolean
  addItem = function(invId, item, count, md, slot)
    return exports['core_inventory']:addItem(invId, item, count or 1, md)
  end,

  --- Remove Item from inventory. core's removeItem matches on name+amount only
  --- (no metadata/slot filtering), so `md`/`slot` are ignored.
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param md table [Optional] Item Metadata (unsupported by core_inventory)
  ---@param slot number [Optional] Item Slot (unsupported by core_inventory)
  ---@return boolean
  removeItem = function(invId, item, count, md, slot)
    return exports['core_inventory']:removeItem(invId, item, count or 1)
  end,

  --- Check if player/inventory has item. Returns the count when present (the
  --- interface treats a number as truthy), false otherwise. core's hasItem is
  --- boolean-only, so getItemCount is used to honour the count contract.
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param md table [Optional] Item Metadata (unsupported by core_inventory)
  ---@param slot number [Optional] Item Slot (unsupported by core_inventory)
  ---@return number | boolean
  hasItem = function(invId, item, count, md, slot)
    count = count or 1
    local have = exports['core_inventory']:getItemCount(invId, item) or 0
    return have >= count and have or false
  end,

  ---@param invId string | number
  ---@return table  slot-indexed contents
  getItems = function(invId)
    local inv = exports['core_inventory']:getInventory(invId)
    return (inv and (inv.content or inv.items)) or {}
  end,

  ---@param invId string | number
  ---@param slot number
  ---@return table | false
  getItemBySlot = function(invId, slot)
    local item = exports['core_inventory']:getItemBySlot(invId, slot)
    if not item then return false, 'NoItem' end
    return {
      name     = item.name,
      count    = item.amount or item.count,
      metadata = item.metadata,
      slot     = item.slot or slot,
    }
  end,

  --- First matching slot for an item, with an optional metadata filter. Without
  --- a filter we use core's native getItem; with one we scan (core's getItem
  --- doesn't filter on metadata).
  ---@param invId string | number
  ---@param item string
  ---@param md? table
  ---@return table | nil
  getItemByName = function(invId, item, md)
    if not md then
      return exports['core_inventory']:getItem(invId, item)
    end
    for _, v in pairs(bridge.getItems(invId)) do
      if v.name == item and lib.table.compare(v.metadata, md) then
        return v
      end
    end
    return nil
  end,

  --- Same as getItemByName but metadata is required.
  ---@param invId string | number
  ---@param item string
  ---@param md table
  ---@return table | nil
  getItemByMetadata = function(invId, item, md)
    return bridge.getItemByName(invId, item, md)
  end,

  ---@param item string
  ---@return string | false
  getItemLabel = function(item)
    local list = exports['core_inventory']:getItemsList()
    local def = list and list[item]
    return (def and def.label) or false
  end,

  ---@param invId string | number
  ---@param item string
  ---@param count number
  ---@param md table
  ---@return boolean
  canCarryItem = function(invId, item, count, md)
    return exports['core_inventory']:canCarry(invId, item, count or 1, md)
  end,

  --- Set metadata of an item at a specific slot.
  ---@param invId string | number
  ---@param slot number
  ---@param metadata table
  ---@return boolean
  setMetadata = function(invId, slot, metadata)
    return exports['core_inventory']:setMetadata(invId, slot, metadata)
  end,

  --- editMetadata is an alias for setMetadata (same slot-targeted write).
  ---@param invId string | number
  ---@param slot number
  ---@param metadata table
  ---@return boolean
  editMetadata = function(invId, slot, metadata)
    return bridge.setMetadata(invId, slot, metadata)
  end,

  --- Remember the stash config; the actual inventory is created on-demand when
  --- openInventory fires (core has no predefine export). Returns true so callers
  --- that gate on the result proceed.
  ---@param id string
  ---@param data {type?: string, invType?: string, label?: string, maxWeight?: number, maxSlots?: number}
  ---@return boolean
  registerStash = function(id, data)
    stashes[id] = data or {}
    return true
  end,

  --- Normalised inventory snapshot (matches the shape dirk_inventory.get yields).
  ---@param invId string | number
  ---@return table | false
  get = function(invId)
    local inv = exports['core_inventory']:getInventory(invId)
    if not inv then return false end
    return {
      items     = inv.content or inv.items or {},
      maxWeight = inv.maxWeight,
      maxSlots  = inv.maxSlots or inv.slots,
      weight    = inv.weight,
      slots     = inv.slots,
    }
  end,

  ---@param invId string | number
  clearInventory = function(invId)
    return exports['core_inventory']:clearInventory(invId)
  end,

  --- Single item's registered record (name/label/weight/image) or nil.
  ---@param name string
  ---@return table | nil
  item = function(name)
    if type(name) ~= 'string' or name == '' then return nil end
    return bridge.items()[name]
  end,

  --- All registered items, normalised to { name, label, weight, image }.
  --- Cached for the resource lifetime; invalidated when the item image path
  --- changes via /dirk_config.
  ---@return table<string, { name: string, label: string, weight: number, image: string }>
  items = function()
    if cachedItems then return cachedItems end
    local allItems = exports['core_inventory']:getItemsList()
    if not allItems then return {} end
    local formatted = {}
    for k, v in pairs(allItems) do
      formatted[k] = {
        name   = v.name or k,
        label  = v.label or v.name or k,
        weight = v.weight or 0,
        image  = lib.formatImagePath(v.image or v.name or k),
      }
    end
    cachedItems = formatted
    return formatted
  end,
}

if lib.onSettings then
  lib.onSettings('itemImgPath', function() cachedItems = nil end)
end

return bridge
