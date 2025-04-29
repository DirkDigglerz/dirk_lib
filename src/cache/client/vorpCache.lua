if lib.settings.framework ~= 'vorp_core' then return end

local playerLoggedIn = function()
  local PlayerData =  LocalPlayer.state.Character
  if not PlayerData then return end
  cache:set('citizenId', PlayerData.CharId) 
  cache:set('charName', PlayerData.FirstName..' '..PlayerData.LastName)
  cache:set('job', {
    name = PlayerData.Job,
    type = false,
    label = PlayerData.JobLabel,
    grade = PlayerData.Grade,
    isBoss = false,
    bankAuth = false,
    gradeLabel = false,
    duty = true
  })
  cache:set('playerLoaded', true)
  cache:set('metadata', PlayerData.metadata)
end 

AddStateBagChangeHandler('IsInSession', ('player:%s'):format(cache.serverId), function(_, _, value)
  if value then   
    playerLoggedIn()
  else
    cache:set('playerLoaded', false)
    cache:set('job', {
      name = 'logged_off',
      grade = 2,
      onduty = false
    })
  end
end)

AddEventHandler('onResourceStart', function(resourceName)
  if resourceName == GetCurrentResourceName() then 
    if not LocalPlayer.state.IsInSession then return end
    playerLoggedIn()
  end
end)

RegisterNetEvent('QBCore:Client:SetDuty', function(duty) 
  local originalCache = json.decode(json.encode(cache.job)) 
  originalCache.onduty = duty
  cache:set('job', originalCache)
end)

AddEventHandler("vorp:playerGroupChange",function(source, newgroup,oldgroup) 
  cache:set('gang', gang)
end)

AddEventHandler("vorp:playerJobChange", function(source, newjob,oldjob) 
  cache:set('job', {
    name = job.name,
    type = job.type,
    label = job.label,
    grade = job.grade.level,
    isBoss = job.isboss,
    bankAuth = job.bankAuth,
    gradeLabel = job.grade.name,
    duty = job.onduty
  })
end)


RegisterNetEvent('qbx_core:client:onSetMetaData', function(meta, oldVal, val)
  local old_data = cache.metadata or {}
  old_data[meta] = val
  cache:set('metadata', old_data)
end)


RegisterNetEvent('QBCore:Player:SetPlayerData', function(newData)
  cache:set('playerData', newData)
end)