local cachedItems

-- Forward-declared so the table's methods can reference `bridge` (e.g.
-- getItemBySlot → bridge.getItems). With `local bridge = {...}` the local
-- isn't in scope inside its own initializer, so the self-references would
-- resolve to a nil global.
local bridge

-- qs-inventory stores per-item metadata under `info` (qb-core convention).
-- dirk_lib's contract is that every item exposes `.metadata`, so we normalise
-- on the way out: mirror `info` onto `metadata` for every item the bridge
-- returns. Writes go back through SetItemMetadata (qs persists them as `info`),
-- so the round-trip stays consistent and consumers only ever touch `.metadata`.
local function withMetadata(items)
  if type(items) ~= 'table' then return {} end
  for _, it in pairs(items) do
    if type(it) == 'table' and it.metadata == nil then
      it.metadata = it.info or {}
    end
  end
  return items
end

bridge = {
  --- Add Item to inventory either playerid or invId
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param slot number [Optional] Item Slot
  ---@param md table [Optional] Item Metadata
  ---@return boolean
  addItem  = function(invId, item, count, md, slot)
    if type(invId) == 'number' or tonumber(invId) then
      return exports['qs-inventory']:AddItem(invId, item, count, slot, md)
    else 
      return exports['qs-inventory']:AddItemIntoStash(invId, item, count, slot, md, nil, nil)
    end
    return false 
  end,

  --- Remove Item from inventory either playerid or invId
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param slot number [Optional] Item Slot
  ---@param md table [Optional] Item Metadata
  ---@return boolean
  removeItem = function(invId, item, count, md, slot)
    if type(invId) == 'number' or tonumber(invId) then
      return exports['qs-inventory']:RemoveItem(invId, item, count, slot, md)
    else
      return exports['qs-inventory']:RemoveItemIntoStash(invId, item, count, slot, md)
    end
    return false
  end,

  --- Check if player has item in inventory
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param slot number [Optional] Item Slot
  ---@param md table [Optional] Item Metadata
  ---@return nil | number | boolean  Returns nil if player does not have item, returns number of items if they have it
  hasItem = function(invId, item, count, md, slot) 
    local items = {}
    if type(invId) ~= 'number' then 
      items = withMetadata(exports['qs-inventory']:GetStashItems(invId))
    else
      items = withMetadata(exports['qs-inventory']:GetInventory(invId))
    end
    if not items then return false end
    for k,v in pairs(items) do 
      if v.name == item then 
        if not count or ((v.count and count <= v.count) or (v.amount and count <= v.amount)) then 
          if not slot or slot == v.slot then
            if not md or lib.table.compare(v.metadata, md) then 
              return v.count
            end
          end 
        end
      end
    end
    return false
  end,

  --- Slot-indexed snapshot of every item in the inventory (player or stash).
  getItems = function(invId)
    if type(invId) ~= 'number' and not tonumber(invId) then
      return withMetadata(exports['qs-inventory']:GetStashItems(invId) or {})
    end
    return withMetadata(exports['qs-inventory']:GetInventory(invId) or {})
  end,

  --- Single slot lookup. qs has no direct per-slot export, so walk the snapshot.
  getItemBySlot = function(invId, slot)
    for _, v in pairs(bridge.getItems(invId)) do
      if v.slot == slot then return v end
    end
    return nil
  end,

  --- First matching slot for an item (optional metadata filter).
  getItemByName = function(invId, item, md)
    for _, v in pairs(bridge.getItems(invId)) do
      if v.name == item and (not md or lib.table.compare(v.metadata, md)) then
        return v
      end
    end
    return nil
  end,

  --- Same as getItemByName but with metadata required.
  getItemByMetadata = function(invId, item, md)
    return bridge.getItemByName(invId, item, md)
  end,

  --- Some consumers call lib.inventory.get; same shape as getItems.
  get = function(invId)
    return bridge.getItems(invId)
  end,

  --- Set metadata of an item at a specific slot.
  --- This is the missing piece behind the qs bugs: the fishing rod stores its
  --- reel/line/hook AND bait count in the rod item's metadata. qs had no
  --- setMetadata, so those writes fell through to the framework bridge (which
  --- ignores the slot) and never persisted — parts vanished on re-read and bait
  --- never decremented. SetItemMetadata writes it back into qs properly.
  ---@param invId number|string
  ---@param slot number
  ---@param metadata table
  setMetadata = function(invId, slot, metadata)
    return exports['qs-inventory']:SetItemMetadata(invId, slot, metadata)
  end,

  --- editMetadata is an alias for setMetadata.
  editMetadata = function(invId, slot, metadata)
    return bridge.setMetadata(invId, slot, metadata)
  end,

  --- Single item's registered record (name/label/weight/image) or nil.
  item = function(name)
    if type(name) ~= 'string' or name == '' then return nil end
    return bridge.items()[name]
  end,

  getItemLabel = function(item)
    return exports['qs-inventory']:GetItemLabel(item)
  end,

  registerStash = function(id, data)
    return exports['qs-inventory']:RegisterStash(0, id, data.maxSlots, data.maxWeight)
  end,
  
  useableItem = function(itemName, callback)
    exports['qs-inventory']:CreateUsableItem(itemName, function(src, item)
      callback(src, item)
    end)
  end,

  --- Get all items registered on the server. Cached per resource lifetime.
  ---@return table<string, { name: string, label: string, weight: number, image: string }>
  items = function()
    if cachedItems then return cachedItems end
    local allItems = exports['qs-inventory']:GetItemList()
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

