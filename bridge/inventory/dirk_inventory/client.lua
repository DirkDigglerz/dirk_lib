local cachedItems

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

  ---@function lib.inventory.items
  ---@description # Get all items registered on the server. Cached per resource lifetime.
  ---@return table<string, { name: string, label: string, weight: number, image: string }>
  items = function()
    if cachedItems then return cachedItems end
    local allItems = exports.dirk_inventory:Items()
    if not allItems then return {} end
    local itemImgPath = lib.settings.itemImgPath or ''
    local formatted = {}
    for k, v in pairs(allItems) do
      formatted[k] = {
        name   = v.name or k,
        label  = v.label or v.name or k,
        weight = v.weight or 0,
        image  = ('%s/%s.png'):format(itemImgPath, v.image or v.name or k),
      }
    end
    cachedItems = formatted
    return formatted
  end,
}