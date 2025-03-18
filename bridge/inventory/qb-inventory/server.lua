
local settings = lib.settings 

RegisterNetEvent(('%s_exploitableEvent:openInventory'):format(cache.resource), function(invId, data)
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
      count    = item.count or item.amount,
      metadata = item.metadata,
    }
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
    return 
  end,
}
