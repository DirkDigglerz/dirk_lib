return {
  getItemLabel = function(_item)
    return _item
  end,

  identifier = function()
    return lib.FW.PlayerData.identifier
  end,

  name = function()
    local name = lib.FW.PlayerData.name 
    local firstName, lastName = name:match("(%a+)%s+(.*)")
    return firstName, lastName
  end,

  getPlayerData = function() -- needs formatting
    return lib.FW.PlayerData
  end,

  getItems = function()
    return lib.FW.PlayerData.inventory or {}
  end,

  getMetadata = function(_key)
    return lib.getPlayerMetadata(_key)
  end,
  
  getMoney = function(_account)
    local accounts = lib.FW.PlayerData.accounts  
    for _, account in pairs(accounts) do
      if account.name == _account then
        return account.money
      end
    end
    return 0
  end,

  getJob = function()
    local playerData = lib.FW.PlayerData
    local rawJob = playerData.job
    local jobInfo = lib.FW.Jobs[rawJob.name] or {}
    local gradeInfo = jobInfo.grades and jobInfo.grades[tostring(rawJob.grade)] or {}
    local ret = {
      name       = rawJob.name,
      type       = rawJob.type,
      label      = rawJob.label,
      grade      = rawJob.grade,
      gradeLabel = rawJob.grade_label,
      bankAuth   = rawJob.bankAuth,
      isBoss     = rawJob.isboss,
      duty       = false
    }
    return ret
  end,

  getGang = function()
    return {
      name = 'none', 
      gade = 0,
    }
  end,

  editStatus = function(status, value)
    TriggerEvent(value > 0 and 'esx_status:add' or 'esx_status:remove', status, math.abs(value))
  end,

  hasLicense = function(license)
    if not license then return true; end
    return lib.callback.await('dirk_lib:player:hasLicense', license)
  end,

  getLicenses = function(src)
    return lib.callback.await('dirk_lib:player:getLicenses')
  end,


  ---@function lib.player.hasGroup
  ---@description # Check if a player has a specific group
  ---@param group string | Record<string, number> | Array<string>
  ---@return boolean
  hasGroup = function(group)
    local playerData = lib.FW.PlayerData
    local jobName, jobGrade = playerData.job?.name, playerData.job?.grade
    local gangName, gangGrade = playerData.gang?.name, playerData.gang?.grade
    return lib.hasGroup({
      name = jobName,
      grade = jobGrade
    }, {
      name = gangName,
      grade = gangGrade
    }, group)
  end,
}

