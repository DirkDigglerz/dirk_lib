return {
  isInside = function()
    local current = exports['qs-housing']:getCurrentHouse()
    if current then
      return true, current, nil
    end
    return false
  end,
}
