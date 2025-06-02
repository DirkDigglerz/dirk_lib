return {
  NetworkOverrideClockTime = function(hour, minute, second)
    Citizen.InvokeNative(0x669E223E64B1903C, hour, minute, second, 0, true)
  end,

  SetWeatherTypeOvertimePersist = function(weatherType, transitionTime)
    Citizen.InvokeNative(0x59174F1AFE095B5A, joaat(weatherType), true, false, true, transitionTime, false)
  end,

  GetNameOfZone = function(x, y, z, zoneTypeId)
    if type(x) == 'table' then
      z = x.z
      y = x.y
      x = x.x
    end
    
    return Citizen.InvokeNative(0x43AD8FC02B429D33 ,x,y,z, zoneTypeId or 10)
  end,

  IsControlJustPressed = function(inputGroup, control)
    return Citizen.InvokeNative(0x580417101DDB492F, inputGroup, control)
  end,

  UiPromptDisablePromptsThisFrame = function()
    Citizen.InvokeNative(0xF1622CE88A1946FB)
  end,

  AddBlipForCoord = function(x, y, z)
    if type(x) == 'table' then
      z = x.z
      y = x.y
      x = x.x
    end
    return Citizen.InvokeNative(0x554D9D53F696D002,1664425300, x, y, z)
  end,

  CreatePed = function(pedType, modelHash, x, y, z, heading, isNetwork, thisScriptCheck, p7, p8)
    print('CreatePed called with modelHash: ' .. tostring(modelHash))
    return Citizen.InvokeNative(0xD49F9B0955C367DE, modelHash, x, y, z, heading, isNetwork, thisScriptCheck, p7, p8)
  end,
  
  SetPedDefaultOutfit = function(ped, p1)
    Citizen.InvokeNative(0x283978A15512B2FE, ped, p1)
  end,
}