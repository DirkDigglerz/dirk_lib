return {
  setFuel = function(veh, val, _type)
    return exports['qs-fuelstations']:SetFuel(veh, val)
  end,

  getFuel = function(veh)
    return exports['qs-fuelstations']:GetFuel(veh)
  end
}
