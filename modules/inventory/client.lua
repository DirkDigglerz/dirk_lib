local settings = lib.settings
local inventoryBridge = lib.loadBridge('inventory', settings.inventory, 'client')
local frameworkBridge = lib.loadBridge('framework', settings.framework, 'client')

return {
  ---@function lib.player.getItems
  ---@description # Get the inventory of a player
  ---@return table
  getItems  = inventoryBridge.getItems or frameworkBridge.getItems,

  ---@function lib.inventory.displayMetadata 
  ---@description # Display metadata of an item with the specific key
  ---@param labels table | string # table of metadata to display the string of the metadata key
  ---@param value? string # value of the metadata key
  ---@return boolean 
  displayMetadata = inventoryBridge.displayMetadata or frameworkBridge.displayMetadata or function()
    lib.print.info(('displayMetadata not implemented for %s go manually add your metadata displays or dont'):format(settings.inventory))
  end,

  ---@function lib.inventory.hasItem
  ---@description # Check if player has item in inventory
  ---@param itemName: string
  ---@param count?: number
  ---@param metadata?: table
  ---@param slot?: number
  ---@return nil | number | boolean  Returns nil if player does not have item, returns number of items if they have it
  hasItem           = inventoryBridge.hasItem or frameworkBridge.hasItem,


  ---@function lib.inventory.openStash 
  ---@description # Open a stash inventory
  ---@param id string | number # Inventory ID or Player ID
  ---@param data table # Inventory data
  openStash         = inventoryBridge.openStash or frameworkBridge.openStash,

  ---@function lib.inventory.getItemLabel 
  ---@description # Get the label of an item
  ---@param item string # Item name
  ---@return string
  getItemLabel      = inventoryBridge.getItemLabel or frameworkBridge.getItemLabel,
}