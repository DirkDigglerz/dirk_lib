local settings = lib.settings
local inventory_bridge = lib.loadBridge('inventory', settings.inventory, 'server')
local framework_bridge = lib.loadBridge('framework', settings.framework, 'server')

return {
  ---@function lib.inventory.useableItem
  ---@description # Register a useable item
  ---@param itemName: string
  ---@param callback: function
  ---@param item: table
  ---@return void
  useableItem       = inventory_bridge.useableItem or framework_bridge.useableItem,


  ---@function lib.inventory.canUseItem
  ---@description # Check if player can use item return its function
  ---@param itemName: string
  ---@return func | nil
  canUseItem        = inventory_bridge.canUseItem or framework_bridge.canUseItem,


  ---@function lib.inventory.addItem
  ---@description # Add Item to inventory either playerid or invId
  ---@param invId: string | number # Inventory ID or Player ID
  ---@param itemName: string
  ---@param count?: number
  ---@param metadata?: table
  ---@param slot?: number
  addItem           = inventory_bridge.addItem or framework_bridge.addItem,


  ---@function lib.inventory.removeItem
  ---@description # Remove Item from inventory either playerid or invId
  ---@param invId: string | number # Inventory ID or Player ID
  ---@param itemName: string
  ---@param count?: number
  ---@param metadata?: table
  ---@param slot?: number
  removeItem        = inventory_bridge.removeItem or framework_bridge.removeItem,

  ---@function lib.inventory.hasItem
  ---@description # Check if player has item in inventory
  ---@param invId: string | number # Inventory ID or Player ID
  ---@param itemName: string
  ---@param count?: number
  ---@param metadata?: table
  ---@param slot?: number
  ---@return nil | number | boolean  Returns nil if player does not have item, returns number of items if they have it
  hasItem           = inventory_bridge.hasItem or framework_bridge.hasItem,

  ---@param item: string
  ---@return string
  getItemLabel      = inventory_bridge.getItemLabel or framework_bridge.getItemLabel,

  ---@param invId: string
  ---@param data: {type: string, maxWeight: number, maxSlots: number}
  registerStash     = inventory_bridge.registerStash or framework_bridge.registerStash,

  ---@param invId: string
  get            = inventory_bridge.get or framework_bridge.get,

  ---@function lib.inventory.clearInventory
  ---@description # Clear inventory
  ---@param invId: string
  clearInventory    = inventory_bridge.clearInventory or framework_bridge.clearInventory,

  ---@function lib.inventory.editMetadata
  ---@description # Edit metadata of an item at a specific slot
  ---@param itemName: string
  ---@param metadata: table
  ---@param combine?: boolean
  editMetadata      = inventory_bridge.editMetadata or framework_bridge.editMetadata,



  ---@param invId: string
  getItems          = inventory_bridge.getItems or framework_bridge.getItems,

  ---@param invId: string
  ---@param slot: number
  getItemBySlot     = inventory_bridge.getItemBySlot or framework_bridge.getItemBySlot,

  ---@param invId: string
  ---@param itemName: string
  getItemByName     = inventory_bridge.getItemByName or framework_bridge.getItemByName,

  ---@param invId: string
  ---@param metadata: table
  getItemByMetadata = inventory_bridge.getItemByMetadata or framework_bridge.getItemByMetadata,

  ---@param item: string
  ---@return table
  item              = inventory_bridge.item or framework_bridge.item,

  

}