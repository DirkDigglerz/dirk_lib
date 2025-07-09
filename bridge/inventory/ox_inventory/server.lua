return {

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
    return exports.ox_inventory:GetInventoryItems(invId)
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



} 
