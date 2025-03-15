return {

  --- Add Item to inventory either playerid or invId
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param slot number [Optional] Item Slot
  ---@param md table [Optional] Item Metadata
  ---@return boolean
  addItem  = function(invId, item, count, md, slot) 
    if type(invId) ~= 'number' then 
      return lib.print.info(('codem-inventory does not support adding items to non-player inventories yet.'))
    end 
    return exports['codem-inventory']:AddItem(invId, item, count, slot, md)
  end,

  --- Remove Item from inventory either playerid or invId
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param slot number [Optional] Item Slot
  ---@param md table [Optional] Item Metadata
  ---@return boolean
  removeItem = function(invId, item, count, md, slot)
    if type(invId) ~= 'number' then 
      return lib.print.info(('codem-inventory does not support removing items from non-player inventories yet.'))
    end 
    if md then 
      lib.print.info(('codem-inventory does not support removing items by metadata yet.'))
    end 
    return exports['codem-inventory']:RemoveItem(invId, item, count, slot)
  end,

  --- Check if player has item in inventory
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param slot number [Optional] Item Slot
  ---@param md table [Optional] Item Metadata
  ---@return nil | number | boolean  Returns nil if player does not have item, returns number of items if they have it
  hasItem = function(invId, item, count, md, slot) 
    if type(invId) ~= 'number' then 
      return lib.print.info(('codem-inventory does not support checking items in non-player inventories yet.'))
    end
    local citizen_id = lib.player.identifier(invId)
    local items = exports['codem-inventory']:GetInventory(citizen_id, invId)
    for k,v in pairs(items) do 
      if v.name == item then 
        if not count or count <= v.count then 
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
    return exports['codem-inventory']:GetItemLabel(item)
  end,



  registerStash = function(id, data)
    return true, 'no_such_thing_on_codem_inventory'
  end,
  
} 
