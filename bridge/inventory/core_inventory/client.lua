local settings = lib.settings
local cachedItems

local bridge = {
  ---@function lib.inventory.displayMetadata
  ---@description # core_inventory has no metadata-display API; no-op with a hint.
  ---@param labels table | string
  ---@param value? string
  ---@return boolean
  displayMetadata = function(labels, value)
    lib.print.info(('displayMetadata not implemented for %s go manually add your metadata displays or dont'):format(settings.inventory))
    return false
  end,

  ---@function lib.inventory.hasItem
  ---@description # Check if the local player has an item. core's client API is
  ---name+count only — metadata/slot filtering isn't available client-side.
  ---@param itemName string
  ---@param count? number
  ---@param metadata? table (unsupported client-side)
  ---@param slot? number (unsupported client-side)
  ---@return number | nil  count when present, nil otherwise
  hasItem = function(itemName, count, metadata, slot)
    count = count or 1
    local have = exports['core_inventory']:getItemCount(itemName) or 0
    return have >= count and have or nil
  end,

  ---@function lib.inventory.getItems
  ---@description # The local player's inventory contents.
  ---@return table
  getItems = function()
    local inv = exports['core_inventory']:getInventory()
    return (inv and (inv.content or inv.items)) or {}
  end,

  ---@function lib.inventory.openStash
  ---@description # Ask the server to open a stash for us (core opens stashes
  ---server-side via openInventory). `data` is forwarded so a one-off stash can
  ---pass its label/type even without a prior registerStash.
  ---@param id string | number
  ---@param data? table
  openStash = function(id, data)
    TriggerServerEvent(('%s:openInventory'):format(cache.resource), id, data or {})
  end,

  ---@function lib.inventory.getItemLabel
  ---@param item string
  ---@return string | false
  getItemLabel = function(item)
    local list = exports['core_inventory']:getItemsList()
    local def = list and list[item]
    return (def and def.label) or false
  end,

  ---@function lib.inventory.items
  ---@description # All registered items, normalised to { name, label, weight, image }.
  ---@return table<string, { name: string, label: string, weight: number, image: string }>
  items = function()
    if cachedItems then return cachedItems end
    local allItems = exports['core_inventory']:getItemsList()
    if not allItems then return {} end
    local formatted = {}
    for k, v in pairs(allItems) do
      formatted[k] = {
        name   = v.name or k,
        label  = v.label or v.name or k,
        weight = v.weight or 0,
        image  = lib.formatImagePath(v.image or v.name or k),
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
