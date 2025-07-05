local parseOptions = function(opts)
  for k,v in pairs(opts) do 
    opts[k].onSelect = v.action
    if v.action then 
      local action = v.action
      opts[k].action = function(entity)
        action({
          entity = entity,
        })
      end
    end

    if v.canInteract then 
      local canInteract = v.canInteract
      opts[k].canInteract = function(entity)
        return canInteract({
          entity = entity,
        })
      end
    end 
  end
  return opts
end

return {
  box = function(id,data)
    assert(data.pos, 'Missing position')
    assert(data.height, 'Missing height')
    assert(data.options, 'Missing options')
    data.options = parseOptions(data.options)
    for k,v in pairs(data.options) do 
      if not v.distance then v.distance = (data.distance or 1.5); end
    end
    local newTarget = exports.ox_target:addBoxZone({
      name   = id,
      coords = vector3(data.pos.x, data.pos.y, data.pos.z),
      size   = vector3((data.length or 1.0), (data.width or 1.0), (data.height or 1.0)),
      rotation = data.pos.w,
      debug = data.debug,
      options = data.options,
    })
  end,
  
  polyzone = function(id,data)
    assert(data.polygon, 'Missing polygon')
    assert(data.height, 'Missing height')
    assert(data.options, 'Missing options')
    data.options = parseOptions(data.options)
    local temp_target_system = nil
    local minZ = 999999999
    for k,v in pairs(data.polygon) do 
      data.polygon[k] = vector2(v.x, v.y)
      if v.z <= minZ then minZ = v.z; end
    end

    for k,v in pairs(data.options) do 
      if not v.distance then v.distance = (data.distance or 1.5); end
    end
    
    local zone = exports['qb-target']:AddPolyZone(name, data.polygon, {
      name = name, -- This is the name of the zone recognized by PolyZone, this has to be unique so it doesn't mess up with other zones
      debugPoly = data.debug, -- This is for enabling/disabling the drawing of the box, it accepts only a boolean value (true or false), when true it will draw the polyzone in green
      minZ = minZ, -- This is the bottom of the polyzone, this can be different from the Z value in the coords, this has to be a float value
      maxZ = minZ + data.height, -- This is the top of the polyzone, this can be different from the Z value in the coords, this has to be a float value
    }, {
      options = parseOptions(data.options),
      distance = data.distance or 1.5, -- This is the distance for you to be at for the target to turn blue, this is in GTA units and has to be a float value
    })
    return name
  end, 


  removeZone = function(id)
    assert(id, 'Missing id')
    exports.ox_target:removeZone(id)
  end,

  entity = function(entity,data)
    assert(data.options, 'Missing options')
    assert(data.distance, 'Missing distance')
    data.options = parseOptions(data.options)
    if data.networked then
      return exports.ox_target:addEntity(entity, data.options)
    else
      return exports.ox_target:addLocalEntity(entity, data.options)
    end
  end,

  removeEntity = function(entity, net)
    assert(entity, 'Missing entity')
    if net then
      exports.ox_target:removeEntity(entity)
    else
      exports.ox_target:removeLocalEntity(entity)
    end
  end,

  addModels = function(data)
    data.options = parseOptions(data.options)
    return exports.ox_target:addModel(data.models, data.options)
  end, 

  addGlobalVehicle = function(data)
    data.options = parseOptions(data.options)
    return exports.ox_target:addGlobalVehicle(data.options)
  end,
  

  addGlobalPed = function(data)
    data.options = parseOptions(data.options)
    return exports.ox_target:addGlobalPed(data.options)
  end,


  addGlobalPlayer = function(data)
    data.options = parseOptions(data.options)
    return exports.ox_target:addGlobalPlayer(data.options)
  end,
}