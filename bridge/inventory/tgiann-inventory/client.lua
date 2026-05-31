local TGI = 'tgiann-inventory'
local cachedItems

local bridge = {

  ---@function lib.inventory.displayMetadata
  ---@description Configure tooltip metadata display
  ---@param labels table | string
  ---@param value? string
  displayMetadata = function(labels, value)
    return exports[TGI]:DisplayMetadata(labels, value)
  end,

  ---@function lib.inventory.hasItem
  ---@description Check if local player has item
  ---@param itemName string
  ---@param count? number
  ---@param metadata? table
  ---@param slot? number
  ---@return number | boolean
  hasItem = function(itemName, count, metadata, slot)
    count = count or 1

    if slot then
      local slotData = exports[TGI]:GetItemBySlot(slot)
      if not slotData or slotData.name ~= itemName then return false end
      local amount = slotData.amount or slotData.count or 0
      if metadata then
        for k, v in pairs(metadata) do
          if not slotData.info or slotData.info[k] ~= v then return false end
        end
      end
      return amount >= count and amount or false
    end

    local total = exports[TGI]:GetItemCount(itemName, metadata, true)
    if not total or total == 0 then return false end
    return total >= count and total or false
  end,

  ---@function lib.inventory.getItems
  ---@description Local player's slot-indexed inventory.
  getItems = function()
    return exports[TGI]:GetPlayerItems() or {}
  end,

  ---@function lib.inventory.openStash
  ---@description Open a stash UI on the client. Consumers pass (id, data) — tgiann's
  --- OpenInventory natively takes the stash id and metadata as its 2nd/3rd args.
  ---@param id string | number
  ---@param data table
  openStash = function(id, data)
    return exports[TGI]:OpenInventory('stash', id, data)
  end,

  ---@function lib.inventory.getItemLabel
  ---@param item string
  getItemLabel = function(item)
    return exports[TGI]:GetItemLabel(item)
  end,

  ---@function lib.inventory.items
  ---@description All registered items, normalised. Cached per resource lifetime;
  --- invalidates on branding.itemImgPath change.
  ---@return table<string, { name: string, label: string, weight: number, image: string }>
  items = function()
    if cachedItems then return cachedItems end
    local all = exports[TGI]:Items()
    if not all then return {} end
    local out = {}
    for k, v in pairs(all) do
      out[k] = {
        name   = v.name or k,
        label  = v.label or v.name or k,
        weight = v.weight or 0,
        image  = lib.formatImagePath(v.image or v.name or k),
      }
    end
    cachedItems = out
    return out
  end,
}

if lib.onSettings then
  lib.onSettings('itemImgPath', function() cachedItems = nil end)
end

return bridge
