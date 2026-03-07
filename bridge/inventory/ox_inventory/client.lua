return {
  ---@function lib.inventory.displayMetadata 
  ---@description # Display metadata of an item with the specific key
  ---@param labels table | string # table of metadata to display the string of the metadata key
  ---@param value? string # value of the metadata key
  ---@return boolean 
  displayMetadata = function(labels, value)
    return exports.ox_inventory:displayMetadata(labels, value)
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
    return has >= count and has or nil 
  end,

  getItems = function()
    return exports.ox_inventory:GetPlayerItems()
  end,


  items = function()
    local allItems = exports.ox_inventory:Items()
    local itemImgPath = lib.settings.itemImgPath
    local formatted = {}
    for k,v in pairs(allItems) do 
      local img = v.client?.image or v.name
      local imgUrl = ('%s/%s.png'):format(itemImgPath, img)
      formatted[k] = {
        name = v.name,
        label = v.label,
        weight = v.weight,
        image = imgUrl,
      }
    end
    return formatted
  end,
}