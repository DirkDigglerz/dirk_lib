local settings = lib.settings 
return {
  ---@function lib.inventory.displayMetadata 
  ---@description # Display metadata of an item with the specific key
  ---@param labels table | string # table of metadata to display the string of the metadata key
  ---@param value? string # value of the metadata key
  ---@return boolean 
  displayMetadata = function(labels, value)
    lib.print.info(('displayMetadata not implemented for %s go manually add your metadata displays or dont'):format(settings.inventory))
    return false
  end,

  ---@function lib.inventory.hasItem
  ---@description # Check if player has item in inventory
  ---@param itemName: string
  ---@param count?: number
  ---@param metadata?: table
  ---@param slot?: number
  ---@return nil | number | boolean  Returns nil if player does not have item, returns number of items if they have it
  hasItem           = function(itemName, count, metadata, slot)
    count = count or 1
    if slot then 
      local found = exports.ox_inventory:Search('slots', itemName, metadata)
      for k,v in pairs(found) do 
        if v.slot == slot and v.count >= count then
          return true
        end
      end
    end 

    local has = exports.ox_inventory:Search('count', itemName, metadata)
    return has >= count and has or 0 
  end,


  openStash = function(id, data)
    TriggerServerEvent(('%s_exploitableEvent:openInventory'):format(cache.resource), id, data)
  end, 

}