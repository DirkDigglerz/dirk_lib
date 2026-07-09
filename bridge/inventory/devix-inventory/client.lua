local DEVIX = 'devix-inventory'
local settings = lib.settings
local cachedItems

-- devix stores per-item metadata under `info` and quantity under `amount`.
-- dirk_lib's contract is `.metadata` / `.count` / `.slot`. Mirror them on the
-- way out so the client bridge matches the server bridge and consumers (e.g.
-- the fishing-rod loadout) that read `item.slot` / `item.metadata` client-side
-- actually match. Same fix as the core_inventory client bridge.
local function normalise(items)
  if type(items) ~= 'table' then return {} end
  for key, it in pairs(items) do
    if type(it) == 'table' then
      it.slot = it.slot or key
      if it.metadata == nil then it.metadata = it.info or {} end
      if it.count == nil then it.count = it.amount end
    end
  end
  return items
end

local bridge = {
  ---@function lib.inventory.displayMetadata
  ---@description # devix has no documented client metadata-display API; no-op with a hint.
  ---@param labels table | string
  ---@param value? string
  ---@return boolean
  displayMetadata = function(labels, value)
    lib.print.info(('displayMetadata not implemented for %s — add your metadata displays manually or ignore'):format(settings.inventory))
    return false
  end,

  ---@function lib.inventory.hasItem
  ---@description # Check if the local player has an item. Walk the normalised
  --- local snapshot so we can honour count/metadata/slot without guessing the
  --- exact client export signatures.
  ---@param itemName string
  ---@param count? number
  ---@param metadata? table
  ---@param slot? number
  ---@return number | nil  count when present, nil otherwise
  hasItem = function(itemName, count, metadata, slot)
    count = count or 1
    local total = 0
    for _, v in pairs(bridge.getItems()) do
      if v.name == itemName
        and (not slot or v.slot == slot)
        and (not metadata or lib.table.compare(v.metadata, metadata)) then
        total += (v.count or v.amount or 0)
      end
    end
    return total >= count and total or nil
  end,

  ---@function lib.inventory.getItems
  ---@description # The local player's inventory contents, normalised (slot key
  --- stamped onto each item, info→metadata, amount→count). GetPlayerItems() is
  --- devix's client-side inventory read, confirmed by the devix dev (2026-07).
  ---@return table
  getItems = function()
    return normalise(exports[DEVIX]:GetPlayerItems() or {})
  end,

  ---@function lib.inventory.openStash
  ---@description # Ask the server to open a stash for us (mirrors core_inventory:
  --- devix opens stashes server-side). `data` is forwarded so a one-off stash
  --- can pass its label/type even without a prior registerStash.
  ---@param id string | number
  ---@param data? table
  openStash = function(id, data)
    TriggerServerEvent(('%s:openInventory'):format(cache.resource), id, data or {})
  end,

  ---@function lib.inventory.getItemLabel
  ---@param item string
  ---@return string | false
  getItemLabel = function(item)
    local def = exports[DEVIX]:GetSharedItemInfo(item)
    return (def and def.label) or false
  end,

  ---@function lib.inventory.items
  ---@description # All registered items, normalised to { name, label, weight, image }.
  ---@return table<string, { name: string, label: string, weight: number, image: string }>
  items = function()
    if cachedItems then return cachedItems end
    local all = exports[DEVIX]:GetItemList()
    if not all then return {} end
    local formatted = {}
    for k, v in pairs(all) do
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
