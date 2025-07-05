local parseOptions = function(options)
  for k,v in pairs(options) do 
    if v.action then 
      v.onSelect = v.action
    end 
  end
  return options
end


return {
  entity = function(entity, data)
    local interact_data = {
      id = data.id or ('entity_%s'):format(entity), 
      entity = entity, 
      netId = data.networked and entity or nil,
      -- netId  = data.network and entity or nil, 
      options = parseOptions(data.options),
      renderDistance = data.renderDistance or 10.0,
      activeDistance = data.distance       or 1.5,
      cooldown       = data.cooldown       or 1500,
      offset         = data.offset,
    }
    if data.networked then 
      exports.sleepless_interact:addEntity(interact_data)
    else
      exports.sleepless_interact:addLocalEntity(interact_data)
    end
  end,

  addModels = function(data)
    local interact_data = {
      id = data.id or ('model_%s'):format(data.model),
      models = data.models, 
      model  = #data.models == 1 and data.models[1] or nil,
      options = parseOptions(data.options),
      renderDistance = data.renderDistance or 10.0,
      activeDistance = data.distance       or 1.5,
      cooldown       = data.cooldown       or 1500,
      offset         = data.offset,
    }
    exports.sleepless_interact:addGlobalModel(interact_data)
  end, 

  addGlobalVehicle = function(data)
    local id = ('globalVehicle_%s'):format(math.random(1, 1000000))
    local options = {
      id = id,
      options = parseOptions(data.options),
      renderDistance = data.renderDistance or 10.0,
      activeDistance = data.distance       or 1.5,
      cooldown       = data.cooldown       or 1500,
      offset         = data.offset,
      bone           = data.bone,
    }
    exports.sleepless_interact:addGlobalVehicle(options)
    return id 
  end,

  addCoords = function(data)
    local interact_data = {
      id = data.id or ('coords_%s'):format(data.pos), 
      coords = vector3(data.pos.x, data.pos.y, data.pos.z), 
      options = parseOptions(data.options),
      renderDistance = data.renderDistance or 10.0,
      activeDistance = data.distance       or 1.5,
      cooldown       = data.cooldown       or 1500,
      offset         = data.offset,
    }
    exports.sleepless_interact:addCoords(interact_data)
  end,

  addGlobalPlayer = function(data)
    local interact_data = {
      id = data.id or ('player_%s'):format(math.random(1, 1000000)), 
      options = parseOptions(data.options),
      renderDistance = data.renderDistance or 10.0,
      activeDistance = data.distance       or 1.5,
      cooldown       = data.cooldown       or 1500,
      offset         = data.offset,
    }
    exports.sleepless_interact:addGlobalPlayer(interact_data)
  end,

  addGlobalPed = function(data)
    local interact_data = {
      id = data.id or ('ped_%s'):format(math.random(1, 1000000)), 
      options = parseOptions(data.options),
      renderDistance = data.renderDistance or 10.0,
      activeDistance = data.distance       or 1.5,
      cooldown       = data.cooldown       or 1500,
      offset         = data.offset,
    }

    exports.sleepless_interact:addGlobalPed(interact_data)
  end,


  removeById = function(id)
    exports.sleepless_interact:removeById(id)
  end,

  removeEntity = function(entity)
    exports.sleepless_interact:removeEntity(entity)
  end,

  removeGlobalModel = function(model)
    exports.sleepless_interact:removeGlobalModel(model)
  end,

  removeGlobalPlayer = function(player)
    exports.sleepless_interact:removeGlobalPlayer(player)
  end,

  
}

return lib.interact