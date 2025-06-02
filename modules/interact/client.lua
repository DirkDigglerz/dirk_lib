local settings = lib.settings
local parseOptions = function(options)
  for k,v in pairs(options) do 
    if v.action then 
      v.onSelect = v.action
    end 
  end
  return options
end


lib.interact = {
  entity = function(entity, data)
    if settings.interact == 'sleepless_interact' then
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
        
    elseif settings.interact == 'redm-uiprompt' then 

    end 
  end,

  addModels = function(data)
    if settings.interact == 'sleepless_interact' then
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
    elseif settings.interact == 'marker' then 

    end 
  end, 

  addGlobalVehicle = function(data)
    local id = ('globalVehicle_%s'):format(math.random(1, 1000000))
    if settings.interact == 'sleepless_interact' then
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
    elseif settings.ineract == 'marker' then 

    end 
  end,

  addCoords = function(data)
    if settings.interact == 'sleepless_interact' then
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
    elseif settings.interact == 'marker' then 

    end
  end,

  addGlobalPlayer = function(data)
    if settings.interact == 'sleepless_interact' then
      local interact_data = {
        id = data.id or ('player_%s'):format(math.random(1, 1000000)), 
        options = parseOptions(data.options),
        renderDistance = data.renderDistance or 10.0,
        activeDistance = data.distance       or 1.5,
        cooldown       = data.cooldown       or 1500,
        offset         = data.offset,
      }
      exports.sleepless_interact:addGlobalPlayer(interact_data)
    elseif settings.interact == 'marker' then 

    end 
  end,

  addGlobalPed = function(data)
    if settings.interact == 'sleepless_interact' then
      local interact_data = {
        id = data.id or ('ped_%s'):format(math.random(1, 1000000)), 
        options = parseOptions(data.options),
        renderDistance = data.renderDistance or 10.0,
        activeDistance = data.distance       or 1.5,
        cooldown       = data.cooldown       or 1500,
        offset         = data.offset,
      }
  
      exports.sleepless_interact:addGlobalPed(interact_data)
    elseif settings.interact == 'marker' then 

    end 
  end,


  removeById = function(id)
    if settings.interact == 'sleepless_interact' then
      exports.sleepless_interact:removeById(id)
    elseif settings.interact == 'marker' then 

    end 
  end,

  removeEntity = function(entity)
    if settings.interact == 'sleepless_interact' then
      exports.sleepless_interact:removeEntity(entity)
    elseif settings.interact == 'marker' then 

    end 
  end,

  removeGlobalModel = function(model)
    if settings.interact == 'sleepless_interact' then
      exports.sleepless_interact:removeGlobalModel(model)
    elseif settings.interact == 'marker' then 

    end 
  end,

  removeGlobalPlayer = function(player)
    if settings.interact == 'sleepless_interact' then
      exports.sleepless_interact:removeGlobalPlayer(player)
    elseif settings.interact == 'marker' then 

    end 
  end,

  
}

return lib.interact