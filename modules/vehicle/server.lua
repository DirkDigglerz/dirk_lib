-- `settings` is a LOCAL in init.lua, not a global — every other server module
-- pulls it off `lib` like this. Without the line these three loadBridge calls
-- index a nil, so the whole module threw the first time anything on the server
-- touched `lib.vehicle`.
local settings = lib.settings

local keys = lib.loadBridge('keys', settings.keys, 'server')
local fuel = lib.loadBridge('fuel', settings.fuel, 'server')
local framework = lib.loadBridge('framework', settings.framework, 'server')

lib.vehicle = {
  addKeys = function(src, veh,plate)
    if not keys.addKeys then return lib.print.error(('No bridge found for adding keys for %s'):format(settings.keys)) end
    return keys.addKeys(src, veh,plate)
  end, 

  removeKeys = function(src, veh,plate)
    if not keys.removeKeys then return lib.print.error(('No bridge found for removing keys for %s'):format(settings.keys)) end
    return keys.removeKeys(src,veh,plate)
  end,

  --- Lock or unlock a vehicle, through whatever key script the server runs.
  ---
  --- Not the same job as `SetVehicleDoorsLocked`, and that is the whole reason
  --- this exists. Most modern key scripts hold the lock in a statebag and push
  --- it out to every client themselves — qbx_vehiclekeys writes
  --- `doorslockstate` — so a script that sets the native directly has its value
  --- overwritten the moment the key script next syncs. The door stays shut and
  --- nothing errors.
  ---
  --- Falls through to the native for key scripts we have no bridge function
  --- for, which is still right for the ones that do not manage lock state.
  ---
  --- @param veh number
  --- @param locked boolean  true to lock, false to unlock
  setLockState = function(veh, locked)
    if keys.setLockState then return keys.setLockState(veh, locked) end
    return SetVehicleDoorsLocked(veh, locked and 2 or 1)
  end,

  setFuel = function(veh,val,_type)
    if not fuel.setFuel then return lib.print.error(('No bridge found for setting fuel for %s'):format(settings.fuel)) end
    return fuel.setFuel(veh,val,_type)
  end,

  getFuel = function(veh)
    if not fuel.getFuel then return lib.print.error(('No bridge found for getting fuel for %s'):format(settings.fuel)) end
    return fuel.getFuel(veh)
  end,

  getByPlate = function(plate)
    if not framework.getByPlate then return lib.print.error(('No bridge found for getting vehicle by plate for %s'):format(settings.framework)) end
    return framework.getByPlate(plate)
  end,

  generatePlate = function(format) 
    local newPlate = lib.string.random(format or '........'):upper()
    if lib.vehicle.getByPlate(newPlate) then 
      Wait(0)
      return lib.vehicle.generatePlate(format)
    end
    return newPlate
  end, 
}

return lib.vehicle