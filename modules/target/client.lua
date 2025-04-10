local settings = lib.settings

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


lib.target = {
  box = function(id,data)
    assert(data.pos, 'Missing position')
    assert(data.height, 'Missing height')
    assert(data.options, 'Missing options')
    data.options = parseOptions(data.options)
    if settings.target == 'qb-target' or settings.target == 'qtarget' then 
      exports[settings.target]:AddBoxZone(id, vector3(data.pos.x, data.pos.y, data.pos.z), (data.length or 1.0), (data.width or 1.0), {
        name      = id, -- This is the name of the zone recognized by PolyZone, this has to be unique so it doesn't mess up with other zones
        debugPoly = data.debug, -- This is for enabling/disabling the drawing of the box, it accepts only a boolean value (true or false), when true it will draw the polyzone in green
        heading   = (data.pos.w or 0.0),
        minZ      = data.pos.z - 1.0,
        maxZ      = data.pos.z + data.height,
      }, {
        options = data.options,
        distance = (data.distance or 1.5), -- This is the distance for you to be at for the target to turn blue, this is in GTA units and has to be a float value
      })
    elseif settings.target == 'ox_target' then 
      for k,v in pairs(data.options) do 
        if not v.distance then v.distance = (data.distance or 1.5); end
      end
      local newTarget = exports[settings.target]:addBoxZone({
        name   = id,
        coords = vector3(data.pos.x, data.pos.y, data.pos.z),
        size   = vector3((data.length or 1.0), (data.width or 1.0), (data.height or 1.0)),
        rotation = data.pos.w,
        debug = data.debug,
        options = data.options,
      })
    end
  end,
  
  polyzone = function(id,data)
    assert(data.polygon, 'Missing polygon')
    assert(data.height, 'Missing height')
    assert(data.options, 'Missing options')
    
    data.options = parseOptions(data.options)
    local temp_target_system = nil
    if settings.target == "qb-target" or settings.target == "qtarget" or settings.target == "ox_target" then
      if settings.target == "ox_target" then temp_target_system = "qb-target" else temp_target_system = settings.target;  end
      local minZ = 999999999
      for k,v in pairs(data.polygon) do 
        data.polygon[k] = vector2(v.x, v.y)
        if v.z <= minZ then minZ = v.z; end
      end

      for k,v in pairs(data.options) do 
        if not v.distance then v.distance = (data.distance or 1.5); end
      end
      
      local zone = exports[tempTargetSystem]:AddPolyZone(name, data.polygon, {
        name = name, -- This is the name of the zone recognized by PolyZone, this has to be unique so it doesn't mess up with other zones
        debugPoly = data.debug, -- This is for enabling/disabling the drawing of the box, it accepts only a boolean value (true or false), when true it will draw the polyzone in green
        minZ = minZ, -- This is the bottom of the polyzone, this can be different from the Z value in the coords, this has to be a float value
        maxZ = minZ + data.height, -- This is the top of the polyzone, this can be different from the Z value in the coords, this has to be a float value
      }, {
        options = parseOptions(data.options),
        distance = data.distance or 1.5, -- This is the distance for you to be at for the target to turn blue, this is in GTA units and has to be a float value
      })
      return name
    end
  end, 


  removeZone = function(id)
    assert(id, 'Missing id')
    if settings.target == "qb-target" or settings.target == "q-target" then
      exports[settings.target]:RemoveZone(id)
    elseif settings.target == "ox_target" then
      exports[settings.target]:removeZone(id)
    end
  end,

  entity = function(entity,data)
    assert(data.options, 'Missing options')
    assert(data.distance, 'Missing distance')
    data.options = parseOptions(data.options)
    if settings.target == "qb-target" or settings.target == "qtarget" then
      exports[settings.target]:AddTargetEntity(entity, {
        options = data.options,
        distance = (data.distance or 1.5)
      })
    elseif settings.target == "ox_target" then
      if data.networked then
        return exports[settings.target]:addEntity(entity, data.options)
      else
        return exports[settings.target]:addLocalEntity(entity, data.options)
      end
    end
  end,

  removeEntity = function(entity, net)
    assert(entity, 'Missing entity')
    if settings.target == "qb-target" or settings.target == "qtarget" then
      exports[settings.target]:RemoveTargetEntity(entity)
    elseif settings.target == "ox_target" then
      if net then
        exports.ox_target:removeEntity(entity)
      else
        exports.ox_target:removeLocalEntity(entity)
      end
    end
  end,

  addModels = function(data)
    data.options = parseOptions(data.options)
    if settings.target == "qb-target" or settings.target == "qtarget" then
      exports[settings.target]:AddTargetModel(data.models, {
        distance = (data.distance or 1.5),
        options  = data.options,
      })
    elseif settings.target == "ox_target" then
      return exports.ox_target:addModel(data.models, data.options)
    end
  end, 

  addGlobalVehicle = function(data)
    data.options = parseOptions(data.options)
    if settings.target == "qb-target" then 
      exports[settings.target]:AddGlobalVehicle({
        options = data.options,
        distance = (data.distance or 1.5),
      })
    elseif settings.target == "qtarget" then
      exports[settings.target]:Vehicle({
        options = data.options,
        distance = (data.distance or 1.5),
      })
    elseif settings.target == "ox_target" then
      return exports.ox_target:addGlobalVehicle(data.options)
    end
  end,
  

  addGlobalPed = function(data)
    data.options = parseOptions(data.options)
    if settings.target == "qb-target" then 
      exports[settings.target]:AddGlobalPed({
        options = data.options,
        distance = (data.distance or 1.5),
      })
    elseif settings.target == "qtarget" then
      exports[settings.target]:Ped({
        options = data.options,
        distance = (data.distance or 1.5),
      })
    elseif settings.target == "ox_target" then
      return exports.ox_target:addGlobalPed(data.options)
    end
  end,


  addGlobalPlayer = function(data)
    data.options = parseOptions(data.options)
    if settings.target == "qb-target" then 
      exports[settings.target]:AddGlobalPlayer({
        options = data.options,
        distance = (data.distance or 1.5),
      })
    elseif settings.target == "qtarget" then
      exports[settings.target]:Player({
        options = data.options,
        distance = (data.distance or 1.5),
      })
    elseif settings.target == "ox_target" then
      return exports.ox_target:addGlobalPlayer(data.options)
    end
  end,
}


return lib.target