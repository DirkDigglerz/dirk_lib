local cachedItems

local bridge = {
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


  ---@function lib.inventory.items
  ---@description # Get all items registered on the server. Cached per resource lifetime.
  ---@return table<string, { name: string, label: string, weight: number, image: string, description?: string }>
  items = function()
    if cachedItems then return cachedItems end
    local allItems = exports.ox_inventory:Items()
    if not allItems then return {} end
    local formatted = {}
    for k, v in pairs(allItems) do
      local img = (v.client and v.client.image) or v.name or k
      formatted[k] = {
        name        = v.name or k,
        label       = v.label or v.name or k,
        weight      = v.weight or 0,
        image       = lib.formatImagePath(img),
        -- Surfaced so scripts can source item descriptions from the inventory
        -- (translate once there) rather than re-storing them in their config.
        description = v.description,
      }
    end
    cachedItems = formatted
    return formatted
  end,
}

-- Invalidate the cache when branding.itemImgPath changes — otherwise URLs
-- baked at first call (often with the boot-time autodetect default) hide
-- a CDN URL the user later sets via /dirk_config.
if lib.onSettings then
  lib.onSettings('itemImgPath', function() cachedItems = nil end)
end

return bridge