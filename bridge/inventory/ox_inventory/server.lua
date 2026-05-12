local cachedItems

local bridge = {

  --- Add Item to inventory either playerid or invId
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param slot number [Optional] Item Slot
  ---@param md table [Optional] Item Metadata
  ---@return boolean
  addItem  = function(invId, item, count, md, slot)
    return exports.ox_inventory:AddItem(invId, item, count or 1, md, slot)
  end,

  --- Remove Item from inventory either playerid or invId
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param slot number [Optional] Item Slot
  ---@param md table [Optional] Item Metadata
  ---@return boolean
  removeItem = function(invId, item, count, md, slot)
    return exports.ox_inventory:RemoveItem(invId, item, count or 1, md, slot)
  end,

  --- Check if player has item in inventory
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param slot number [Optional] Item Slot
  ---@param md table [Optional] Item Metadata
  ---@return nil | number | boolean  Returns nil if player does not have item, returns number of items if they have it
  hasItem = function(invId, item, count, md, slot)
    count = count or 1

    if not slot then
      local found = exports.ox_inventory:GetItem(invId, item, md, true)
      if not found then return false end
      return found >= count and found or false
    end

    local itemInSlot = exports.ox_inventory:GetSlot(invId, slot)
    if not itemInSlot then return false end
    if itemInSlot.name ~= item then return false, 'not_right_name' end

    if md then
      for k, v in pairs(md) do
        if itemInSlot.metadata[k] ~= v then
          return false, 'metadata_mismatch'
        end
      end
    end

    if itemInSlot.count < count then
      return false, 'wrong_count'
    end

    return true
  end,

  getItems = function(invId)
    -- Modern ox_inventory has a `GetInventoryItems` convenience export, but
    -- ox-compatible inventories that re-declare `provides 'ox_inventory'`
    -- (notably ak47_inventory) emulate an older snapshot of the API and
    -- don't ship it — calling it there crashes with "No such export".
    --
    -- `GetInventory(invId)` has been part of ox's API since day one and
    -- returns an OxInventory object whose `.items` is the slot-indexed
    -- table the caller wants. Same shape as GetInventoryItems' return,
    -- works on every version + emulation. No second arg — modern ox
    -- treats arg 2 as `owner` (string|number), not a flag, so passing
    -- `true` there is undefined behaviour.
    local inv = exports.ox_inventory:GetInventory(invId)
    return (inv and inv.items) or {}
  end,

  setMetadata = function(invId, slot, metadata)
    return exports.ox_inventory:SetMetadata(invId, slot, metadata)
  end,

  getItemBySlot = function(invId, slot)
    return exports.ox_inventory:GetSlot(invId, slot)
  end,
  
  getItemLabel = function(item)
    local item_exists =  exports.ox_inventory:Items(item)
    return item_exists and item_exists.label or false
  end,

  registerStash = function(id, data)
    return exports.ox_inventory:RegisterStash(id, data.label, data.maxSlots, data.maxWeight, data.owner, data.groups, data.coords)
  end,

  --- Single-item lookup. Returns the formatted record (matching what `items()`
  --- yields) or nil if the item isn't registered. Faster path than walking
  --- the cached all-items map.
  ---@param name string
  item = function(name)
    if type(name) ~= 'string' or name == '' then return nil end
    local raw = exports.ox_inventory:Items(name)
    if not raw then return nil end
    local img = (raw.client and raw.client.image) or raw.name or name
    return {
      name   = raw.name or name,
      label  = raw.label or raw.name or name,
      weight = raw.weight or 0,
      image  = lib.formatImagePath(img),
    }
  end,

  --- Get all items registered on the server. Cached, but invalidated whenever
  --- branding.itemImgPath changes so a CDN URL set via /dirk_config doesn't
  --- get masked by URLs baked from the boot-time autodetect default.
  ---@return table<string, { name: string, label: string, weight: number, image: string }>
  items = function()
    if cachedItems then return cachedItems end
    local allItems = exports.ox_inventory:Items()
    if not allItems then return {} end
    local formatted = {}
    for k, v in pairs(allItems) do
      local img = (v.client and v.client.image) or v.name or k
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
}

-- Invalidate the cache when branding.itemImgPath changes — otherwise URLs
-- baked at first call (often with the boot-time autodetect default) hide
-- a CDN URL the user later sets via /dirk_config.
if lib.onSettings then
  lib.onSettings('itemImgPath', function() cachedItems = nil end)
end

return bridge
