local placeEntity = function(_type, model_name, bounds, networked)
  assert(_type, 'type is required')
  assert(_type == 'object' or _type == 'vehicle' or _type == 'ped', 'type must be object, vehicle or ped')
  assert(model_name, 'model_name is required')
  lib.print.info(('Placing entity %s with model %s'):format(_type, model_name))
  local loaded_model = lib.request.model(model_name) 
  if not loaded_model then
    lib.print.error(('Model %s not loaded in placeEntity'):format(model_name))
    return false, 'model_not_loaded'
  end

  local entity 
  local startPos = GetEntityCoords(cache.ped)
  loaded_model = joaat(model_name)
  if _type == 'object' then
    entity = CreateObject(loaded_model, 0,0,0, networked, true, false)
  elseif _type == 'vehicle' then
    entity = CreateVehicle(loaded_model, 0,0,0, 0, networked, true, false)
  elseif _type == 'ped' then
    entity = CreatePed(loaded_model, 0,0,0, 0, networked, true, false)
  end
  FreezeEntityPosition(entity, true)

  SetEntityCollision(entity, false, false)

  local isValidPos = function(coords)
    if not bounds then return true end
    if type(bounds) == 'table' then 
      local polygon = lib.zones.polyPointCheck(bounds, coords)
    else 
      local dist = #(startPos - coords)
      if dist > bounds then 
        return false
      end
    end 
    return true
  end


  local removeEntity = function()
    DeleteEntity(entity)
  end

  local rotation = GetEntityRotation(entity)
  local min, max = GetModelDimensions(loaded_model)
  while true do 
    local hit, endCoords, entityHit, surfaceNormal, materialHash = lib.raycast.fromCamera(nil, entity, type(bounds) == 'number' and bounds)
    SetEntityAlpha(entity, 100, false)
    if endCoords and entityHit ~= entity and isValidPos(endCoords) then 
      SetEntityCoords(entity, endCoords.x, endCoords.y, endCoords.z)
      SetEntityRotation(entity, rotation.x, rotation.y, rotation.z)
      DrawSphere(endCoords.x, endCoords.y, endCoords.z, 0.1, 255, 0, 0, 100)
    else 
      SetEntityAlpha(entity, 0, false)
    end 

    lib.showHelpNotification('Press ~INPUT_CONTEXT~ to confirm position\nPress ~INPUT_CELLPHONE_LEFT~~INPUT_CELLPHONE_RIGHT~ to rotate\nPress ~INPUT_THROW_GRENADE~ to cancel')

    if IsControlJustPressed(0, 38) then 
      local finalCoords = GetEntityCoords(entity)
      local ret_data = {
        rot = GetEntityRotation(entity),
        pos   = vector4(finalCoords.x, finalCoords.y, finalCoords.z, GetEntityHeading(entity)),
      }
      removeEntity()
      lib.copyToClipboard(('position = vector4(%s, %s, %s, %s)\nrotation = vector3(%s, %s, %s)'):format(finalCoords.x, finalCoords.y, finalCoords.z, GetEntityHeading(entity), rotation.x, rotation.y, rotation.z))
      return ret_data
    elseif IsControlJustPressed(0, 58) then
      removeEntity()
      return false
    elseif IsControlPressed(0, 174) then
      rotation = vector3(rotation.x, rotation.y, rotation.z + 1)
      SetEntityRotation(entity, rotation.x, rotation.y, rotation.z)
    elseif IsControlPressed(0, 175) then
      rotation = vector3(rotation.x, rotation.y, rotation.z - 1)
      SetEntityRotation(entity, rotation.x, rotation.y, rotation.z)
    end

    Wait(0)
  end


end


RegisterCommand('placeEntity', function(source, args)
  local _type = args[1]
  local model_name = args[2]
  placeEntity(_type, model_name, false, true)
end)

lib.placeEntity = placeEntity