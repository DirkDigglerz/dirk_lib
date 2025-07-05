local settings = lib.settings
local bridge   = lib.loadBridge('interact', settings.interact, 'client')

lib.interact = {
  entity             = bridge.entity,
  addModels          = bridge.addModels,
  addGlobalVehicle   = bridge.addGlobalVehicle,
  addCoords          = bridge.addCoords,
  addGlobalPlayer    = bridge.addGlobalPlayer,
  addGlobalPed       = bridge.addGlobalPed,
  removeById         = bridge.removeById,
  removeEntity       = bridge.removeEntity,
  removeGlobalModel  = bridge.removeGlobalModel,
  removeGlobalPlayer = bridge.removeGlobalPlayer, 
}

return lib.interact