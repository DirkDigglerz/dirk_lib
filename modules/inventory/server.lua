local settings = lib.settings
local inventoryBridge = lib.loadBridge('inventory', settings.inventory, 'server')
local frameworkBridge = lib.loadBridge('framework', settings.framework, 'server')

return {
  ---@function lib.inventory.useableItem
  ---@description # Register a useable item
  ---@param itemName: string
  ---@param callback: function
  ---@param item: table
  ---@return void
  useableItem       = inventoryBridge.useableItem or frameworkBridge.useableItem,


  ---@function lib.inventory.canUseItem
  ---@description # Check if player can use item return its function
  ---@param itemName: string
  ---@return func | nil
  canUseItem        = inventoryBridge.canUseItem or frameworkBridge.canUseItem,


  ---@function lib.inventory.addItem
  ---@description # Add Item to inventory either playerid or invId
  ---@param invId: string | number # Inventory ID or Player ID
  ---@param itemName: string
  ---@param count?: number
  ---@param metadata?: table
  ---@param slot?: number
  addItem           = inventoryBridge.addItem or frameworkBridge.addItem,


  ---@function lib.inventory.removeItem
  ---@description # Remove Item from inventory either playerid or invId
  ---@param invId: string | number # Inventory ID or Player ID
  ---@param itemName: string
  ---@param count?: number
  ---@param metadata?: table
  ---@param slot?: number
  removeItem        = inventoryBridge.removeItem or frameworkBridge.removeItem,

  ---@function lib.inventory.hasItem
  ---@description # Check if player has item in inventory
  ---@param invId: string | number # Inventory ID or Player ID
  ---@param itemName: string
  ---@param count?: number
  ---@param metadata?: table
  ---@param slot?: number
  ---@return nil | number | boolean  Returns nil if player does not have item, returns number of items if they have it
  hasItem           = inventoryBridge.hasItem or frameworkBridge.hasItem,

  ---@function lib.inventory.getItemBySlot
  ---@description # Get item by slot
  ---@param invId: string
  ---@param slot: number
  ---@return table
  getItemBySlot     = inventoryBridge.getItemBySlot or frameworkBridge.getItemBySlot,

  ---@param item: string
  ---@return string
  getItemLabel      = inventoryBridge.getItemLabel or frameworkBridge.getItemLabel or function(item)
    return item
  end,

  ---@param invId: string
  ---@param data: {type: string, maxWeight: number, maxSlots: number}
  registerStash     = inventoryBridge.registerStash or frameworkBridge.registerStash,

  ---@param invId: string
  get            = inventoryBridge.get or frameworkBridge.get,

  ---@function lib.inventory.clearInventory
  ---@description # Clear inventory
  ---@param invId: string
  clearInventory    = inventoryBridge.clearInventory or frameworkBridge.clearInventory,

  ---@function lib.inventory.editMetadata
  ---@description # Edit metadata of an item at a specific slot
  ---@param itemName: string
  ---@param metadata: table
  ---@param combine?: boolean
  editMetadata      = inventoryBridge.editMetadata or frameworkBridge.editMetadata,

  ---@param invId: string
  getItems          = inventoryBridge.getItems or frameworkBridge.getItems,

  ---@param invId: string
  ---@param slot: number
  getItemBySlot     = inventoryBridge.getItemBySlot or frameworkBridge.getItemBySlot,

  ---@param invId: string
  ---@param itemName: string
  getItemByName     = inventoryBridge.getItemByName or frameworkBridge.getItemByName,

  ---@param invId: string
  ---@param metadata: table
  getItemByMetadata = inventoryBridge.getItemByMetadata or frameworkBridge.getItemByMetadata,

  ---@function lib.inventory.item
  ---@description # Look up a single item's record by name.
  ---@description Returns the item table (name/label/weight/image/...) if registered, or nil if missing.
  ---@description Useful for "is this item installed?" checks (e.g. the missing-items audit).
  ---@param name string
  ---@return { name: string, label: string, weight: number, image: string }?
  item = inventoryBridge.item or (function()
    -- Resolution priority:
    --   1. inventory bridge `item(name)`                — fastest, native single-item
    --   2. fallback to `items()[name]` IF the inventory has its own `items()` —
    --      the inventory is the source of truth, framework table may be stale or empty
    --   3. framework bridge `item(name)`                — fastest when inventory pulls from framework
    --   4. fallback to `items()[name]`                  — final correctness guarantee
    -- This avoids the footgun where e.g. qs-inventory has its own item list
    -- but the QBCore.Shared.Items table is empty/incomplete on that server.
    if inventoryBridge.items then
      return function(name)
        return (lib.inventory.items() or {})[name]
      end
    end
    if frameworkBridge.item then
      return frameworkBridge.item
    end
    return function(name)
      return (lib.inventory.items() or {})[name]
    end
  end)(),

  ---@function lib.inventory.canCarryItem
  ---@description # Check if player can carry item
  ---@param invId: string
  ---@param itemName: string
  ---@param count: number
  ---@param metadata: table
  ---@return boolean
  canCarryItem      = inventoryBridge.canCarryItem or frameworkBridge.canCarryItem,

  ---@function lib.inventory.items
  ---@description # Get all items registered on the server
  ---@return table<string, { name: string, label: string, weight: number, image: string }>
  items             = inventoryBridge.items or frameworkBridge.items or function() return {} end,

  
  -- NEW 
  ---@function lib.inventory.setMetadata
  ---@description # Set metadata of an item at a specific slot
  ---@param invId: string
  ---@param slot: number
  ---@param metadata: table
  ---@return boolean
  setMetadata = inventoryBridge.setMetadata or frameworkBridge.setMetadata,

  ---@function lib.inventory.getItemBySlot
  ---@description # Get item by slot
  ---@param invId: string
  ---@param slot: number
  ---@return table
  getItemBySlot = inventoryBridge.getItemBySlot or frameworkBridge.getItemBySlot,
}