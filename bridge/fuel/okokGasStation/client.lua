return {
  setFuel = function(veh, val, _type)
    return exports['okokGasStation']:SetFuel(veh, val)
  end, 

  getFuel = function(veh)
    return exports['okokGasStation']:GetFuel(veh)
  end
}