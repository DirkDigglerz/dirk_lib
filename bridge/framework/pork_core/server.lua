return {
  canUseItem = function(item)
    return false
  end,

  useableItem = function(item, cb)
    return false
  end,

  get = function(src)
    return exports.pork_core:getPlayer(src)
  end,

  identifier = function(src)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return ply.citizenId
  end, 

  name = function(src)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return ply.firstName, ply.lastName
  end,

  phoneNumber = function(src)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return 19999
  end, 

  gender = function(src)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return ply.gender
  end, 

  deleteCharacter = function(src, citizenId)
    return exports.pork_core:deleteCharacter(src, citizenId)
  end,

  loginCharacter = function(src, citizenId, newData)
    -- return exports.pork_core:loginPlayer(src, citizenId, newData)
  end,

  logoutCharacter = function(src, citizenId)
    return exports.pork_core:logoutPlayer(src, citizenId)
  end,

  getJob = function(src)
    local ply = lib.player.get(src)
    if not ply then return end
    local rawJob = ply.PlayerData.job
    local ret = {
      name       = rawJob.name,
      type       = rawJob.type,
      label      = rawJob.label,
      grade      = rawJob.grade.level,
      isBoss     = rawJob.grade.isboss,
      bankAuth   = rawJob.bankAuth,
      gradeLabel = rawJob.grade.name,
      duty       = rawJob.onduty
    }
    return ret
  end,

  setJob = function(src, name, rank)
    local ply = lib.player.get(src)
    if not ply then return end
    ply.Functions.SetJob(name, rank)
  end,
  
  setDuty = function(src, duty)
    local ply = lib.player.get(src)
    if not ply then return end
    ply.Functions.SetJobDuty(duty)
  end,

  setPlayerData = function(src, _key, data)
    local ply = lib.player.get(src)
    if not ply then return end
    ply.Functions.SetPlayerData(_key, data)
  end,

  getPlayerData = function(src, _key)
    local ply = lib.player.get(src)
    if not ply then return end
    if _key then
      return ply.PlayerData[_key]
    end
    return ply.PlayerData
  end,

  setMetadata = function(src, _key, data)
    local ply = lib.player.get(src)
    if not ply then return end
    ply.Functions.SetMetaData(_key, data)
  end,

  getMetadata = function(src, _key)
    local ply = lib.player.get(src)
    if not ply then return end
    return ply.Functions.GetMetaData(_key)
  end,

  jail = function()

  end, 

  getMoney = function(src, acc)
    local ply = lib.player.get(src)
    if not ply then return end
    return ply.Functions.GetMoney(acc)
  end,

  addMoney = function(src, acc, count, reason)
    local ply = lib.player.get(src)
    if not ply then return end
    return ply.Functions.AddMoney(acc, count, reason)
  end, 

  removeMoney = function(src, acc, count, reason, force)
    local ply = lib.player.get(src)
    if not ply then return end
    if not force then
      local has = ply.Functions.GetMoney(acc)
      if has < count then return false, 'not_enough' end
    end
    return ply.Functions.RemoveMoney(acc, count, reason)
  end,

  setMoney = function(src, acc, count)
    local ply = lib.player.get(src)
    if not ply then return end
    return ply.Functions.SetMoney(acc, count)
  end, 
}