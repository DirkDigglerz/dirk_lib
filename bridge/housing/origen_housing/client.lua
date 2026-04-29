return {
  isInside = function()
    local inside = exports.origen_housing:insideHouse()
    if inside then
      return true
    end
    return false
  end,
}
