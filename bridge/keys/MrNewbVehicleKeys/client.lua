return {
  addKeys = function(veh, plate)
    return exports.MrNewbVehicleKeys:GiveKeysByPlate(plate)
  end, 

  removeKeys = function(veh, plate)
    return exports.MrNewbVehicleKeys:RemoveKeysByPlate(plate)
  end,
}