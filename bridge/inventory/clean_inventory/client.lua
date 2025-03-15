return {
  openStash = function(id, data)
    -- return exports.dirk_inventory:registerInventory(id, {
    --   type = data.type or 'stash', 
    --   maxWeight = data.maxWeight or 1000,
    --   maxSlots = data.maxSlots or 50,
    -- })
  end, 

  ---@function lib.inventory.displayMetadata 
  ---@description # Display metadata of an item with the specific key
  ---@param labels table | string # table of metadata to display the string of the metadata key
  ---@param value? string # value of the metadata key
  ---@return boolean 
  displayMetadata = function(labels, value)
    return exports.dirk_inventory:displayMetadata(labels, value)
  end,
}