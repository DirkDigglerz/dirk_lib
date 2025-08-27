return {
  --- Add Item to inventory either playerid or invId
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param slot number [Optional] Item Slot
  ---@param md table [Optional] Item Metadata
  ---@return boolean
  addItem  = function(invId, item, count, md, slot) 
    print(('Attempting to add %s to inventory %s'):format(item, invId))
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
    print(('Attempting to remove %s from inventory %s'):format(item, invId))
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
      items = exports['qs-inventory']:GetStashItems(invId)
    else 
      items = exports['qs-inventory']:GetInventory(invId)
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
  end
}

