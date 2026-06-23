
local settings = lib.settings 

RegisterNetEvent(('%s:openInventory'):format(cache.resource), function(invId, data)
  local src = source
  exports['qb-inventory']:OpenInventory(src, invId, {
    label = data.label or 'Stash',
    slots = data.maxSlots or 32,
    maxweight = data.maxWeight or 64000,
  })
end)

return {
    --- Add Item to inventory either playerid or invId
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param slot number [Optional] Item Slot
  ---@param md table [Optional] Item Metadata
  ---@return boolean
  addItem  = function(invId, item, count, md, slot)
    return  exports['qb-inventory']:AddItem(invId, item, count, slot, md, 'dirk_scripts')
  end,

  --- Remove Item from inventory either playerid or invId
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param slot number [Optional] Item Slot
  ---@param md table [Optional] Item Metadata
  ---@return boolean
  removeItem = function(invId, item, count, md, slot)
    return exports['qb-inventory']:RemoveItem(invId, item, count, slot, md, 'dirk_scripts')
  end,

  --- Check if player has item in inventory
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param slot number [Optional] Item Slot
  ---@param md table [Optional] Item Metadata
  ---@return nil | number | boolean  Returns nil if player does not have item, returns number of items if they have it
  hasItem = function(invId, item, count, md, slot)
    local items = exports['qb-inventory']:GetItemsByName(invId, item)
    local hasCount = 0
    if #items > 0 then
      for k, v in pairs(items) do
        local mdMatch = not md or lib.table.compare(v.metadata, md)
        if slot and v.slot == slot then
          if not md or mdMatch then
            return v.amount
          end
          break
        elseif mdMatch then
          hasCount += v.amount
        end
      end
    end
    return hasCount > 0 and hasCount or false
  end,

  getItemBySlot     = function(src, slot)
    if type(src) == 'string' then return false, 'DoesntSupportInvId' end
    local item = exports['qb-inventory']:GetItemBySlot(src, slot)
    if not item then return false, 'NoItem' end
    return {
      name     = item.name,
      slot     = item.slot or slot,
      count    = item.count or item.amount,
      -- qb-inventory stores per-item metadata under `info` (qb-core
      -- convention). dirk_lib's contract exposes it as `metadata`, so mirror
      -- `info` onto `metadata` on the way out. Without this, rod parts written
      -- via setMetadata read back blank. (Mirrors the qs-inventory fix.)
      metadata = item.metadata or item.info,
    }
  end,

  --- Set metadata of an item at a specific slot. qb-inventory has no native
  --- setMetadata; the write previously fell through to the framework bridge,
  --- whose setMetadata targets *player* metadata and ignores the slot, so the
  --- write never persisted to the item (rod reel/line/hook vanished on
  --- re-read). SetItemData(source, itemName, key, val, slot) writes back into
  --- the item's `info` field, which is qb-inventory's metadata store.
  ---@param invId number Player ID (qb-inventory metadata is player-scoped)
  ---@param slot number
  ---@param metadata table
  ---@return boolean
  setMetadata = function(invId, slot, metadata)
    if type(invId) == 'string' then
      lib.print.warn('qb-inventory bridge: setMetadata on stash inventories is not supported')
      return false
    end
    local item = exports['qb-inventory']:GetItemBySlot(invId, slot)
    if not item or not item.name then return false end
    return exports['qb-inventory']:SetItemData(invId, item.name, 'info', metadata, slot)
  end,

  --- editMetadata is an alias for setMetadata.
  editMetadata = function(invId, slot, metadata)
    local item = exports['qb-inventory']:GetItemBySlot(invId, slot)
    if not item or not item.name then return false end
    return exports['qb-inventory']:SetItemData(invId, item.name, 'info', metadata, slot)
  end,

  getItemLabel = function(item)
    local item_exists =  lib.FW?.Shared?.Items[item]
    if not item_exists then return false, 'NoLabel' end
    return item_exists.label
  end,

  canCarryItem = function(src, item, count, md)
    if type(src) == 'string' then return false, 'DoesntSupportInvId' end
    return exports['qb-inventory']:CanAddItem(src, item, count, md)
  end,

  registerStash = function(id, data)
    return exports['qb-inventory']:CreateInventory(id, {
      label = data.label or 'Stash',
      slots = data.maxSlots or 32,
      maxweight = data.maxWeight or 64000,
    })
  end,
}
