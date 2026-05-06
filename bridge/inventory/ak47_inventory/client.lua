local settings = lib.settings
return {
  displayMetadata = function(labels, value)
    lib.print.info(('displayMetadata not implemented for %s — add manual metadata displays as needed'):format(settings.inventory))
    return false
  end,

  hasItem = function(itemName, count, metadata, slot)
    count = count or 1
    local items = lib.player.getPlayerData('items')
    local found = 0
    for _, v in pairs(items) do
      if v.name == itemName then
        local match = (not slot or v.slot == slot) and (not metadata or lib.table.compare(v.metadata or v.info, metadata))
        if match then found = found + (v.amount or v.count or 0) end
      end
    end
    return found >= count and found or false
  end,

  openStash = function(id, data)
    TriggerServerEvent(('%s:openInventory'):format(cache.resource), id, data or {})
  end,

  getItemLabel = function(item)
    local items = lib.FW?.Shared?.Items
    if not items then return false, 'NoItems' end
    local entry = items[item]
    if not entry then return false, 'NoItem' end
    return entry.label
  end,
}
