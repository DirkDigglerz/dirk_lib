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

  setFuel = function(veh,val,_type)
    if not fuel.setFuel then return lib.print.error(('No bridge found for setting fuel for %s'):format(settings.fuel)) end
    return fuel.setFuel(veh,val,_type)

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