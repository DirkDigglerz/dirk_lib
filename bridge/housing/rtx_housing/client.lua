return {
  isInside = function()
    local inside, propertyId, propertyData = exports['rtx_housing']:IsPlayerInPropertyZone()
    if inside then
      return true, propertyId, propertyData
    end
    return false
  end,
}
