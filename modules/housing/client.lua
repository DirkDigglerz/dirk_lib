local settings = lib.settings
local housingResource = settings.housing

local bridge
if housingResource and housingResource ~= 'NOT FOUND' then
  bridge = lib.loadBridge('housing', housingResource, 'client')
end

lib.housing = {
  ---@function lib.housing.isInside
  ---@description Returns whether the player is currently inside a house/property.
  ---@return boolean isInside
  ---@return string|number|nil id Property/house identifier when the resource exposes one
  ---@return table|nil data Extra property data when the resource exposes it
  isInside = function()
    if bridge and bridge.isInside then
      return bridge.isInside()
    end
    return false
  end,
}

return lib.housing
