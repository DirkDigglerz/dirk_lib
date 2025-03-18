return {
  getItemLabel = function(item)
    local items = lib.FW?.Shared?.Items
    if not items then return false, 'NoItems' end
    local item = items[item]
    if not item then return false, 'NoItem' end
    return item.label
  end,
}