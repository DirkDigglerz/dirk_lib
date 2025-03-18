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
    local items = lib.player.getPlayerData('items')
    local found = 0
    for k,v in pairs(items) do 
      if v.name == itemName then 
        local match = (not slot or v.slot == slot) and (not metadata or lib.table.compare(v.metadata, metadata))
        if match then 
          found = found + (v.amount or v.count)
        end
      end
    end
    return found >= count and found or false
  end,

  openStash = function(id, data)
    TriggerServerEvent(('%s_exploitableEvent:openInventory'):format(cache.resource), id, data)
  end, 

  getItemLabel = function(item)
    local items = lib.FW?.Shared?.Items
    if not items then return false, 'NoItems' end
    local item = items[item]
    if not item then return false, 'NoItem' end
    return item.label
  end,

}