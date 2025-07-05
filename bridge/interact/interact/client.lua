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
    local data = {
      netId = data.networked and entity or nil, -- needed for networked entities
      entity = not data.networked and entity or nil, -- needed for local entities
      id = data.id or ('entity_%s'):format(entity), -- unique id for the interaction
      distance = data.distance or 1.5, -- distance at which the interaction is active
      interactDst = data.renderDistance or 10.0, -- distance at which the interaction is rendered
      ignoreLos = data.ignoreLos, -- optional ignores line of sight
      offset = data.offset or vector3(0.0, 0.0, 0.0), -- optional offset from the entity
      bone = data.bone or nil, -- optional bone to attach the interaction to
      groups = data.groups or nil, -- optional groups to restrict the interaction to
      options = parseOptions(data.options), -- options for the interaction
    }
    if data.networked then 
      exports.interact:AddEntityInteraction(data)
    else
      exports.interact:AddLocalEntityInteraction(data)
    end
  end,

  addModels = function(data)

  end, 

  addGlobalVehicle = function(data)
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
  end,

  addCoords = function(data)
    exports.interact:AddInteraction({
      id = data.id or ('coords_%s'):format(data.pos), 
      coords = vector3(data.pos.x, data.pos.y, data.pos.z), 
      distance = data.distance or 1.5,
      interactDst = data.renderDistance or 10.0,
      ignoreLos = false, -- optional ignores line of sight
      groups = data.groups or nil, -- optional groups to restrict the interaction to
      options = parseOptions(data.options), -- options for the interaction
    })
  end,

  addGlobalPlayer = function(data)
    exports.interact:AddGlobalPlayerInteraction({
      id = data.id or ('player_%s'):format(math.random(1, 1000000)), 
      distance = data.distance or 1.5,
      interactDst = data.renderDistance or 10.0,
      ignoreLos = false, -- optional ignores line of sight
      offset = data.offset or vector3(0.0, 0.0, 0.0), -- optional offset from the entity
      groups = data.groups or nil, -- optional groups to restrict the interaction to
      options = parseOptions(data.options), -- options for the interaction
    })
  end,

  addGlobalPed = function(data)
    exports.interact:addGlobalPlayerInteraction({
      id = data.id or ('ped_%s'):format(math.random(1, 1000000)), 
      distance = data.distance or 1.5,
      interactDst = data.renderDistance or 10.0,
      ignoreLos = false, -- optional ignores line of sight
      offset = data.offset or vector3(0.0, 0.0, 0.0), -- optional offset from the entity
      groups = data.groups or nil, -- optional groups to restrict the interaction to
      options = parseOptions(data.options), -- options for the interaction
    })
  end,


  removeById = function(id)
    exports.interact:RemoveInteraction(id)
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
