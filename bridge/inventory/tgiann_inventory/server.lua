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
      return lib.print.error('TGIANN INVENTORY DOES NOT SUPPORT STRING IDS FOR STASH MANIPULATION')
    end
    return exports["tgiann-inventory"]:AddItem(invId, item, count, slot, md)
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
      return lib.print.error('TGIANN INVENTORY DOES NOT SUPPORT STRING IDS FOR STASH MANIPULATION')
    end
    return exports["tgiann-inventory"]:RemoveItem(invId, item, count, slot, md)
  end,

  --- Check if player has item in inventory
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param slot number [Optional] Item Slot
  ---@param md table [Optional] Item Metadata
  ---@return nil | number | boolean  Returns nil if player does not have item, returns number of items if they have it
  hasItem = function(invId, item, count, md, slot) 
    local playerItems = exports["tgiann-inventory"]:GetPlayerItems(invId)
    local hasItem, hasCount = false, 0
    for k,v in pairs(playerItems) do 
      if v.name == item then 
        if not count or count <= v.count then 
          if not slot or slot == v.slot then
            if not count or ((v.count and count <= v.count) or (v.amount and count <= v.amount)) then 
              hasItem = true
              hasCount = v.count
              break
            end
          end 
        end
        break
      end
    end
    return hasItem and hasCount or false 
  end,

  

  getItemLabel = function(item)
    return exports["tgiann-inventory"]:GetItemLabel(item)
  end,



  registerStash = function(id, data)
    return lib.print.info(('TGIANN INVENTORY DOES NOT SUPPORT REGISTERING STASHES [IGNORE]'))
  end,
  




} 


