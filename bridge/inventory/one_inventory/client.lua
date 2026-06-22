local INV = 'one_inventory'
local cachedItems

local bridge = {
  ---@function lib.inventory.displayMetadata
  ---@description # Display metadata of an item with the specific key
  ---@param labels table | string # table of metadata to display the string of the metadata key
  ---@param value? string # value of the metadata key
  ---@return boolean
  displayMetadata = function(labels, value)
    -- one_inventory ships the ox-compatible client `displayMetadata` alias.
    return exports[INV]:displayMetadata(labels, value)
  end,

  ---@function lib.inventory.hasItem
  ---@description # Check if player has item in inventory
  ---@param itemName string
  ---@param count? number
  ---@param metadata? table
  ---@param slot? number
  ---@return nil | number Returns the held count when present, nil otherwise
  hasItem = function(itemName, count, metadata, slot)
    count = count or 1

    if slot then
      local slotItem = exports[INV]:GetSlot(slot)
      if not slotItem or slotItem.name ~= itemName then return nil end
      if metadata then
        local meta = slotItem.metadata or {}
        for k, v in pairs(metadata) do
          if meta[k] ~= v then return nil end
        end
      end
      return (slotItem.count or 0) >= count and slotItem.count or nil
    end

    local total = exports[INV]:GetItemCount(itemName, metadata)
    return (total and total >= count) and total or nil
  end,

  ---@function lib.player.getItems
  ---@description # Get the local player's inventory (slot-indexed snapshot)
  ---@return table
  getItems = function()
    return exports[INV]:GetInventoryItems() or {}
  end,

  ---@function lib.inventory.openStash
  ---@description # Open a stash inventory
  ---@param id string | number
  ---@param data? table
  openStash = function(id, data)
    data = data or {}
    if data.id == nil then data.id = id end
    return exports[INV]:OpenInventory('stash', data)
  end,

  ---@function lib.inventory.getItemLabel
  ---@description # Get the label of an item
  ---@param item string
  ---@return string
  getItemLabel = function(item)
    local def = exports[INV]:GetItemDefinition(item)
    return (def and def.label) or item
  end,

  ---@function lib.inventory.items
  ---@description # Get all items registered on the server. Cached per resource lifetime.
  ---@return table<string, { name: string, label: string, weight: number, image: string }>
  items = function()
    if cachedItems then return cachedItems end
    local allItems = exports[INV]:GetAllItemDefinitions()
    if not allItems then return {} end
    local formatted = {}
    for k, v in pairs(allItems) do
      local img = (v.client and v.client.image) or v.image or v.name or k
      formatted[k] = {
        name   = v.name or k,
        label  = v.label or v.name or k,
        weight = v.weight or 0,
        image  = lib.formatImagePath(img),
      }
    end
    cachedItems = formatted
    return formatted
  end,
}

if lib.onSettings then
  lib.onSettings('itemImgPath', function() cachedItems = nil end)
end

return bridge
