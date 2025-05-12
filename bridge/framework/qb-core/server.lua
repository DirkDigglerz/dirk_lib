return {
  canUseItem = function(item)
    local itemInfo = lib.FW.Functions.CanUseItem(item)
    if type(itemInfo) ~= 'table' then
      return false
    end

    if not itemInfo.func then 
      return false
    end

    return itemInfo.func 
  end,

  useableItem = function(item, cb)
    return lib.FW.Functions.CreateUseableItem(item,cb)
  end,
}