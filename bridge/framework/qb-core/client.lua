return {
  getItemLabel = function(item)
    local items = lib.FW?.Shared?.Items
    if not items then return false, 'NoItems' end
    local item = items[item]
    if not item then return false, 'NoItem' end
    return item.label
  end,
  
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

  getItems = function()
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

  getGang = function()
    local playerData = lib.FW.Functions.GetPlayerData()
    local rawGang = playerData.gang
    local ret = {
      name       = rawGang.name,
      type       = rawGang.type,
      label      = rawGang.label,
      grade      = rawGang.grade.level,
      isBoss     = rawGang.isboss,
      bankAuth   = rawGang.bankAuth,
      gradeLabel = rawGang.grade.name,
      duty       = rawGang.onduty
    }
    return ret
  end,

  editStatus = function(status, value)
    local events = {
      hunger = 'consumables:server:addHunger',
      thirst = 'consumables:server:addThirst',
      addStress = 'hud:server:GainStress',
      removeStress = 'hud:server:RemoveStress',
    }
    -- For using values in 1000s (ESX OLD STYLE)
    if value > 100 or value < -100 then
      value = value * 0.0001
    end
    
    if status ~= 'stress' then 
      local current = lib.FW.Functions.GetPlayerData().metadata[status]
      current = current or 0
      local event = events[status]
      if event then
        TriggerServerEvent(event, current + value)
      else 
        lib.print.info(('There is no event for status:%s in qb-core if it exists please add it to the events table bridge/player/qb-core/client.lua'):format(status))  
      end
    else 
      local event = value > 0 and events['addStress'] or events['removeStress']
      TriggerServerEvent(event, math.abs(value))
    end 
  end,

  hasLicense = function(license)
    if not license then return true; end 
    local licenses = lib.player.getMetadata('licenses')
    if not licenses then return false; end 
    if type(license) == 'string' then 
      return licenses[license]
    elseif type(license) == 'table' then 
      for k,v in pairs(license) do 
        if license[v] then 
          return true 
        end  
      end 
    end
    return false 
  end,

  getLicenses = function()
    return lib.player.getMetadata('licenses')
  end, 

  hasGroup = function(group)
    return lib.hasGroup(lib.player.getJob(), lib.player.getGang(), group)
  end,

}
