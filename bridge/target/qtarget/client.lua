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
    exports['qtarget']:AddBoxZone(id, vector3(data.pos.x, data.pos.y, data.pos.z), (data.length or 1.0), (data.width or 1.0), {
      name      = id, -- This is the name of the zone recognized by PolyZone, this has to be unique so it doesn't mess up with other zones
      debugPoly = data.debug, -- This is for enabling/disabling the drawing of the box, it accepts only a boolean value (true or false), when true it will draw the polyzone in green
      heading   = (data.pos.w or 0.0),
      minZ      = data.pos.z - 1.0,
      maxZ      = data.pos.z + data.height,
    }, {
      options = data.options,
      distance = (data.distance or 1.5), -- This is the distance for you to be at for the target to turn blue, this is in GTA units and has to be a float value
    })
  end,
  
  polyzone = function(id,data)
    assert(data.polygon, 'Missing polygon')
    assert(data.height, 'Missing height')
    assert(data.options, 'Missing options')
    
    data.options = parseOptions(data.options)
    local minZ = 999999999
    for k,v in pairs(data.polygon) do 
      data.polygon[k] = vector2(v.x, v.y)
      if v.z <= minZ then minZ = v.z; end
    end

    for k,v in pairs(data.options) do 
      if not v.distance then v.distance = (data.distance or 1.5); end
    end
    
    local zone = exports['qtarget']:AddPolyZone(name, data.polygon, {
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
    exports['qtarget']:RemoveZone(id)
  end,

  entity = function(entity,data)
    assert(data.options, 'Missing options')
    assert(data.distance, 'Missing distance')
    data.options = parseOptions(data.options)
    exports['qtarget']:AddTargetEntity(entity, {
      options = data.options,
      distance = (data.distance or 1.5)
    })
  end,

  removeEntity = function(entity, net)
    assert(entity, 'Missing entity')
    exports['qtarget']:RemoveTargetEntity(entity)
  end,

  addModels = function(data)
    data.options = parseOptions(data.options)
    exports['qtarget']:AddTargetModel(data.models, {
      distance = (data.distance or 1.5),
      options  = data.options,
    })
  end, 

  addGlobalVehicle = function(data)
    data.options = parseOptions(data.options)
    exports['qtarget']:Vehicle({
      options = data.options,
      distance = (data.distance or 1.5),
    })
  end,
  

  addGlobalPed = function(data)
    data.options = parseOptions(data.options)
    exports['qtarget']:Ped({
      options = data.options,
      distance = (data.distance or 1.5),
    })
  end,


  addGlobalPlayer = function(data)
    data.options = parseOptions(data.options)
    exports['qtarget']:Player({
      options = data.options,
      distance = (data.distance or 1.5),
    })
  end,
}
