-- Synchronised scenes — port from dirk-core. Self-contained, natives-only.
local Defaults = {
  sceneConfig = {
    position     = vector3(0.0, 0.0, 0.0),
    rotation     = vector3(0.0, 0.0, 0.0),
    rotOrder     = 2,
    useOcclusion = false,
    loop         = false,
    unk1         = 1.0,
    animTime     = 0,
    animSpeed    = 1.0,
  },
  pedConfig = {
    blendIn  = 1.0,
    blendOut = 1.0,
    duration = 0,
    flag     = 0,
    speed    = 1.0,
    unk1     = 0,
  },
  entityConfig = {
    blendIn  = 1.0,
    blendOut = 1.0,
    flags    = 1,
  },
}

local function default(value, key, kind)
  if value ~= nil then return value end
  return Defaults[kind][key]
end

local scenes = {
  defaults = Defaults,

  create = function(cfg)
    return NetworkCreateSynchronisedScene(cfg.position, cfg.rotation, cfg.rotOrder, cfg.useOcclusion, cfg.loop, cfg.unk1, cfg.animTime, cfg.animSpeed)
  end,

  sceneConfig = function(pos, rot, rotOrder, useOcclusion, loop, unk1, animTime, animSpeed)
    return {
      position     = default(pos,          'position',     'sceneConfig'),
      rotation     = default(rot,          'rotation',     'sceneConfig'),
      rotOrder     = default(rotOrder,     'rotOrder',     'sceneConfig'),
      useOcclusion = default(useOcclusion, 'useOcclusion', 'sceneConfig'),
      loop         = default(loop,         'loop',         'sceneConfig'),
      unk1         = default(unk1,         'unk1',         'sceneConfig'),
      animTime     = default(animTime,     'animTime',     'sceneConfig'),
      animSpeed    = default(animSpeed,    'animSpeed',    'sceneConfig'),
    }
  end,

  addPed = function(cfg)
    return NetworkAddPedToSynchronisedScene(cfg.ped, cfg.scene, cfg.animDict, cfg.animName, cfg.blendIn, cfg.blendOut, cfg.duration, cfg.flag, cfg.speed, cfg.unk1)
  end,

  pedConfig = function(ped, scene, animDict, animName, blendIn, blendOut, duration, flag, speed, unk1)
    return {
      ped      = ped,
      scene    = scene,
      animDict = animDict,
      animName = animName,
      blendIn  = default(blendIn,  'blendIn',  'pedConfig'),
      blendOut = default(blendOut, 'blendOut', 'pedConfig'),
      duration = default(duration, 'duration', 'pedConfig'),
      flag     = default(flag,     'flag',     'pedConfig'),
      speed    = default(speed,    'speed',    'pedConfig'),
      unk1     = default(unk1,     'unk1',     'pedConfig'),
    }
  end,

  addEntity = function(cfg)
    return NetworkAddEntityToSynchronisedScene(cfg.entity, cfg.scene, cfg.animDict, cfg.animName, cfg.blendIn, cfg.blendOut, cfg.flags)
  end,

  entityConfig = function(entity, scene, animDict, animName, blendIn, blendOut, flags)
    return {
      entity   = entity,
      scene    = scene,
      animDict = animDict,
      animName = animName,
      blendIn  = default(blendIn,  'blendIn',  'entityConfig'),
      blendOut = default(blendOut, 'blendOut', 'entityConfig'),
      flags    = default(flags,    'flags',    'entityConfig'),
    }
  end,

  start = function(scene) NetworkStartSynchronisedScene(scene) end,
  stop  = function(scene) NetworkStopSynchronisedScene(scene)  end,
}

return scenes
