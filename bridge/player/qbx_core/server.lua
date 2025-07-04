

return {
  get = function(src)
    return exports['qbx_core']:GetPlayer(src)
  end,

  identifier = function(src)
    
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return ply.PlayerData.citizenid
  end, 

  name = function(src)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return ply.PlayerData.charinfo.firstname, ply.PlayerData.charinfo.lastname
  end,

  phoneNumber = function(src)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return ply.PlayerData.charinfo.phone
  end, 

  gender = function(src)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return ply.PlayerData.charinfo.gender or 'unknown'
  end, 

  deleteCharacter = function(src, citizenId)
    return exports.qbx_core:DeleteCharacter(citizenId)
  end,

  loginCharacter = function(src, citizenId, newData)
    return exports.qbx_core:Login(src, citizenId, newData)
  end,

  logoutCharacter = function(src, citizenId)
    return exports.qbx_core:Logout(src)
  end,

  getCharacters = function(src)
    local license = getIdentifierType(src, lib.settings.primaryIdentifier)
    local toRet = {}
    local result = MySQL.query.await('SELECT * FROM players WHERE license = ?', {license})
    for k,v in pairs(result) do
      local charInfo = json.decode(v.charinfo)
      local playerSkin = getSkin(v.citizenid)
      local lastPos = json.decode(v.position)
      local format_pos = vector3(lastPos.x, lastPos.y, lastPos.z)
      local metadata = {}
      for k,v in ipairs(characterMetadata) do 
        table.insert(metadata, {
          icon = v.icon,
          value = v.get(src),
        })
      end 
      
      table.insert(toRet, {
        firstName  = charInfo.firstname,
        lastName   = charInfo.lastname,
        dob        = charInfo.birthdate,
        state      = 'occupied',
        lastpos    = format_pos, 
        citizenId  = v.citizenid, 
        gender     = charInfo.gender == 0 and 'male' or 'female',
        networth   = getNetWorthQB(v.money),

        model      = playerSkin?.model or "mp_m_freemode_01",
        skin       = playerSkin?.skin or {},
        metadata   = metadata,
        slot      = v.cid,
      })
    end
    return toRet
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
      isBoss     = rawJob.isboss,
      bankAuth   = rawJob.bankAuth,
      gradeLabel = rawJob.grade.name,
      duty = rawJob.onduty
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

  addMoney = function(src, acc, amount, reason)
    local ply = lib.player.get(src)
    if not ply then return end
    return ply.Functions.AddMoney(acc, amount, reason)
  end, 

  removeMoney = function(src, acc, amount, reason, force)
    local ply = lib.player.get(src)
    if not ply then return end
    -- Check has money unless force 
    if not force then
      local has = ply.Functions.GetMoney(acc)
      if not has then return false, 'no_account' end
      if has < amount then return false, 'not_enough' end
    end
    return ply.Functions.RemoveMoney(acc, amount, reason)
  end,

  setMoney = function(src, acc, amount)
    local ply = lib.player.get(src)
    if not ply then return end
    return ply.Functions.SetMoney(acc, amount)
  end
}