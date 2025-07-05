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
        
    elseif settings.interact == 'interact' then
      local export = data.networked and 'AddEntityInteraction' or 'AddLocalEntityInteraction' 
      exports.interact:[export]({
        netId = data.networked and entity or nil, -- needed for networked entities
        entity = not data.networked and entity or nil, -- needed for local entities
        id = data.id or ('entity_%s'):format(entity), -- unique id for the interaction
        distance = data.distance or 1.5, -- distance at which the interaction is active
        interactDst = data.renderDistance or 10.0, -- distance at which the interaction is rendered
        ignoreLos = false, -- optional ignores line of sight
        offset = data.offset or vector3(0.0, 0.0, 0.0), -- optional offset from the entity
        bone = data.bone or nil, -- optional bone to attach the interaction to
        groups = data.groups or nil, -- optional groups to restrict the interaction to
        options = parseOptions(data.options), -- options for the interaction
      })
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
    elseif settings.interact == 'interact' then 

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
    elseif settings.ineract == 'interact' then 
      exports.interact:AddGlobalVehicleInteraction({
        id = id,
        model = data.model,
        distance = data.distance or 1.5,
        interactDst = data.renderDistance or 10.0,
        ignoreLos = false, -- optional ignores line of sight
        offset = data.offset or vector3(0.0, 0.0, 0.0), -- optional offset from the entity
        bone = data.bone or nil, -- optional bone to attach the interaction to
        groups = data.groups or nil, -- optional groups to restrict the interaction to
        options = parseOptions(data.options), -- options for the interaction
      })
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
    elseif settings.interact == 'interact' then 
      exports.interact:AddInteraction({
        id = data.id or ('coords_%s'):format(data.pos), 
        coords = vector3(data.pos.x, data.pos.y, data.pos.z), 
        distance = data.distance or 1.5,
        interactDst = data.renderDistance or 10.0,
        ignoreLos = false, -- optional ignores line of sight
        groups = data.groups or nil, -- optional groups to restrict the interaction to
        options = parseOptions(data.options), -- options for the interaction
      })
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
    elseif settings.interact == 'interact' then 
      exports.interact:AddGlobalPlayerInteraction({
        id = data.id or ('player_%s'):format(math.random(1, 1000000)), 
        distance = data.distance or 1.5,
        interactDst = data.renderDistance or 10.0,
        ignoreLos = false, -- optional ignores line of sight
        offset = data.offset or vector3(0.0, 0.0, 0.0), -- optional offset from the entity
        groups = data.groups or nil, -- optional groups to restrict the interaction to
        options = parseOptions(data.options), -- options for the interaction
      })
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
    elseif settings.interact == 'interact' then 
      exports.interact:addGlobalPlayerInteraction({
        id = data.id or ('ped_%s'):format(math.random(1, 1000000)), 
        distance = data.distance or 1.5,
        interactDst = data.renderDistance or 10.0,
        ignoreLos = false, -- optional ignores line of sight
        offset = data.offset or vector3(0.0, 0.0, 0.0), -- optional offset from the entity
        groups = data.groups or nil, -- optional groups to restrict the interaction to
        options = parseOptions(data.options), -- options for the interaction
      })
    end 
  end,


  removeById = function(id)
    if settings.interact == 'sleepless_interact' then
      exports.sleepless_interact:removeById(id)
    elseif settings.interact == 'interact' then 
      exports.interact:RemoveInteraction(id)
    end 
  end,

  removeEntity = function(entity)
    if settings.interact == 'sleepless_interact' then
      exports.sleepless_interact:removeEntity(entity)
    end 
  end,

  removeGlobalModel = function(model)
    if settings.interact == 'sleepless_interact' then
      exports.sleepless_interact:removeGlobalModel(model)
    end 
  end,

  removeGlobalPlayer = function(player)
    if settings.interact == 'sleepless_interact' then
      exports.sleepless_interact:removeGlobalPlayer(player)
    end 
  end,

  
}

return lib.interact