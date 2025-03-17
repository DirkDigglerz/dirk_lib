return {
  
  identifier = function()
    return lib.FW.Functions.GetPlayerData().citizenid
  end,

  name = function()
    local player = lib.FW.Functions.GetPlayerData()
    return player.charinfo.firstname, player.charinfo.lastname
  end,

  getPlayerData = function(_key)
    local playerData = lib.FW.Functions.GetPlayerData()
    if _key then return playerData[_key] end
    return playerData
  end,

  getMetadata = function(_key)
    local metadata = lib.FW.Functions.GetPlayerData().metadata
    return _key and metadata[_key] or metadata
  end,

  getInventory = function()
    return lib.FW.Functions.GetPlayerData().items
  end,

  getMoney = function(_account)
    local playerData = lib.FW.Functions.GetPlayerData()
    return playerData.money[_account] or 0 
  end,

  getJob = function()
    local playerData = lib.FW.Functions.GetPlayerData()
    local rawJob = playerData.job
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
}