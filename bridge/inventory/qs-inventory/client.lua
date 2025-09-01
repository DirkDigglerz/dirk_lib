return {
  ---@function lib.inventory.displayMetadata 
  ---@description # Display metadata of an item with the specific key
  ---@param labels table | string # table of metadata to display the string of the metadata key
  ---@param value? string # value of the metadata key
  ---@return boolean 
  displayMetadata = function(labels, value)
    -- return exports.ox_inventory:displayMetadata(labels, value)
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
      local inventoryItems = lib.inventory.getItems()
      local found = 0
      for k,v in pairs(inventoryItems) do 
        if v.name == itemName then 
          found += v.count 
        end 
      end 
      return found >= count and count or nil 
    end 

    local has = exports['qs-inventory']:Search(itemName)
    return has >= count and has or nil 
  end,

  getItems = function()
    return exports['qs-inventory']:getUserInventory()
  end,
}