local settings = lib.settings
local bridge   = lib.loadBridge('target', settings.target, 'client')

return {
  ---@function box
  ---@param id string
  ---@param data table
  ---@return string
  box = bridge.box,
  ---@function polyzone
  ---@param id string
  ---@param data table
  ---@return string 
  polyzone = bridge.polyzone,
  ---@function removeZone
  ---@param id string
  ---@return nil
  removeZone = bridge.removeZone,
  ---@function entity
  ---@param entity number|table
  ---@param data table
  ---@return nil
  entity = bridge.entity,
  ---@function removeEntity
  ---@param entity number|table
  ---@return nil
  removeEntity = bridge.removeEntity,
  ---@function addModels
  ---@param data table
  ---@return nil
  addModels = bridge.addModels,
  ---@function addGlobalVehicle
  ---@param data table
  ---@return nil
  addGlobalVehicle = bridge.addGlobalVehicle,
  ---@function addGlobalPed
  ---@param data table
  ---@return nil
  addGlobalPed = bridge.addGlobalPed,
  ---@function addGlobalPlayer
  ---@param data table
  ---@return nil
  addGlobalPlayer = bridge.addGlobalPlayer,

}
  
 