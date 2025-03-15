local settings = lib.settings
local inventory_bridge = lib.loadBridge('inventory', settings.inventory, 'client')
local framework_bridge = lib.loadBridge('framework', settings.framework, 'client')

return {


  ---@function lib.inventory.displayMetadata 
  ---@description # Display metadata of an item with the specific key
  ---@param labels table | string # table of metadata to display the string of the metadata key
  ---@param value? string # value of the metadata key
  ---@return boolean 
  displayMetadata = inventory_bridge.displayMetadata or framework_bridge.displayMetadata or function()
    lib.print.info(('displayMetadata not implemented for % go manually add your metadata displays or dont'):format(settings.inventory))
  end,

  ---@function lib.inventory.hasItem
  ---@description # Check if player has item in inventory
  ---@param itemName: string
  ---@param count?: number
  ---@param metadata?: table
  ---@param slot?: number
  ---@return nil | number | boolean  Returns nil if player does not have item, returns number of items if they have it
  hasItem           = inventory_bridge.hasItem or framework_bridge.hasItem,
}