local cachedItems

return {

  --- Add Item to inventory either playerid or invId
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param md table [Optional] Item Metadata
  ---@param slot number [Optional] Item Slot
  ---@return boolean
  addItem  = function(invId, item, count, md, slot) 
    return exports.dirk_inventory:addItem(invId, item, count, md, slot)
  end,

  --- Remove Item from inventory either playerid or invId
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param md table [Optional] Item Metadata
  ---@param slot number [Optional] Item Slot
  ---@return boolean
  removeItem = function(invId, item, count, md, slot)
    return exports.dirk_inventory:removeItem(invId, item, count, md, slot)
  end,

  --- Check if player has item in inventory
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param slot number [Optional] Item Slot
  ---@param md table [Optional] Item Metadata
  ---@return nil | number | boolean  Returns nil if player does not have item, returns number of items if they have it
  hasItem = function(invId, item, count, md, slot) 
    return exports.dirk_inventory:hasItem(invId, item, count, md, slot)
  end,
  
  getItemLabel = function(item)
    local item_exists =  exports.dirk_inventory:Items(item)
    return item_exists and item_exists.label or false
  end,

  registerStash = function(id, data)
    return exports.dirk_inventory:registerInventory(id, {
      type = data.type or 'stash', 
      maxWeight = data.maxWeight or 1000,
      maxSlots = data.maxSlots or 50,
    })
  end,

  get = function(invId)
    local retData = {
      items = {},
      maxWeight = 0,
      maxSlots = 0,
      weight = 0,
      slots = 0,
    }

    local invData = exports.dirk_inventory:getInventory(invId)
    if not invData then return false end

    retData.items = invData.items
    retData.maxWeight = invData.maxWeight
    retData.maxSlots = invData.maxSlots
    retData.weight = invData.weight
    retData.slots = invData.slots

    return retData
  end,

  --- Get all items registered on the server. Cached per resource lifetime.
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

