-- ak47_inventory bridge
-- ak47_inventory is largely API-compatible with qb-inventory; if any of the
-- exports below differ on your build, override here and let dirkscripts know.

local INV = 'ak47_inventory'

RegisterNetEvent(('%s:openInventory'):format(cache.resource), function(invId, data)
  local src = source
  exports[INV]:OpenInventory(src, invId, {
    label = data.label or 'Stash',
    slots = data.maxSlots or 32,
    maxweight = data.maxWeight or 64000,
  })
end)

return {
  ---@param invId string | number
  ---@param item string
  ---@param count number
  ---@param md table
  ---@param slot number
  addItem = function(invId, item, count, md, slot)
    return exports[INV]:AddItem(invId, item, count, slot, md, 'dirk_scripts')
  end,

  removeItem = function(invId, item, count, md, slot)
    return exports[INV]:RemoveItem(invId, item, count, slot, md, 'dirk_scripts')
  end,

  hasItem = function(invId, item, count, md, slot)
    local items = exports[INV]:GetItemsByName(invId, item)
    if not items or #items == 0 then return false end
    local hasCount = 0
    for _, v in pairs(items) do
      local mdMatch = not md or lib.table.compare(v.metadata or v.info, md)
      if slot and v.slot == slot then
        if not md or mdMatch then return v.amount or v.count end
        break
      elseif mdMatch then
        hasCount += (v.amount or v.count or 0)
      end
    end
    return hasCount > 0 and hasCount or false
  end,

  getItemBySlot = function(src, slot)
    if type(src) == 'string' then return false, 'DoesntSupportInvId' end
    local item = exports[INV]:GetItemBySlot(src, slot)
    if not item then return false, 'NoItem' end
    return {
      name     = item.name,
      count    = item.count or item.amount,
      metadata = item.metadata or item.info,
    }
  end,

  getItemLabel = function(item)
    local item_exists = lib.FW?.Shared?.Items[item]
    if not item_exists then return false, 'NoLabel' end
    return item_exists.label
  end,

  canCarryItem = function(src, item, count, md)
    if type(src) == 'string' then return false, 'DoesntSupportInvId' end
    return exports[INV]:CanCarryItem(src, item, count, md)
  end,

  registerStash = function(id, data)
    return exports[INV]:CreateStash(id, data.label or 'Stash', data.maxSlots or 32, data.maxWeight or 64000)
  end,
}
