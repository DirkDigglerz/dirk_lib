local settings = lib.settings
local bridge   = lib.loadBridge('interact', settings.interact, 'client')

lib.interact = {
  ---@function lib.interact.entity
  ---@description # Register an entity interaction
  ---@param entity number | string
  ---@param data table
  ---@return void
  entity             = bridge.entity,
  ---@function lib.interact.addModels
  ---@description # Add models for interaction
  ---@param data table
  ---@return void
  addModels          = bridge.addModels,
  ---@function lib.interact.addGlobalVehicle
  ---@description # Add a global vehicle interaction
  ---@param data table
  ---@return string
  addGlobalVehicle   = bridge.addGlobalVehicle,
  ---@function lib.interact.addCoords
  ---@description # Add a coordinate interaction
  ---@param data table
  ---@return void
  addCoords          = bridge.addCoords,
  ---@function lib.interact.addGlobalPlayer
  ---@description # Add a global player interaction
  ---@param data table
  ---@return void
  addGlobalPlayer    = bridge.addGlobalPlayer,
  ---@function lib.interact.addGlobalPed
  ---@description # Add a global ped interaction
  ---@param data table
  ---@return void
  addGlobalPed       = bridge.addGlobalPed,
  ---@function lib.interact.addGlobalModel
  ---@description # Add a global model interaction
  ---@param data table
  ---@return void
  removeById         = bridge.removeById,
  ---@function lib.interact.removeEntity
  ---@description # Remove an entity interaction
  ---@param entity number | string
  ---@return void
  removeEntity       = bridge.removeEntity,
  ---@function lib.interact.removeGlobalModel
  ---@description # Remove a global model interaction
  ---@param model string
  ---@return void
  removeGlobalModel  = bridge.removeGlobalModel,
  ---@function lib.interact.removeGlobalPlayer
  ---@description # Remove a global player interaction
  ---@param player number | string
  ---@return void
  removeGlobalPlayer = bridge.removeGlobalPlayer, 
}

return lib.interact