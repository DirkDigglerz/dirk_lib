if lib.settings.framework ~= 'es_extended' then return end

CreateThread(function()
  while not lib.FW do Wait(500); end 
  while not lib.FW.IsPlayerLoaded() do Wait(500); end
  local PlayerData =  lib.FW.GetPlayerData()
  cache:set('citizenId', PlayerData.identifier)
  cache:set('job', {
    name = PlayerData.job.name,
    type = PlayerData.job.type,
    label = PlayerData.job.label,
    grade = PlayerData.job.grade,
    isBoss = PlayerData.job.isboss,
    bankAuth = PlayerData.job.bankAuth,
    gradeLabel = PlayerData.job.grade_label,
    duty = PlayerData.job.onduty
  })
  cache:set('playerLoaded', true)
end)

RegisterNetEvent('esx:playerLoaded', function(xPlayer)
  cache:set('citizenId', xPlayer.identifier)
  cache:set('job', {
    name = xPlayer.job.name,
    type = xPlayer.job.type,
    label = xPlayer.job.label,
    grade = xPlayer.job.grade,
    isBoss = xPlayer.job.isboss,
    bankAuth = xPlayer.job.bankAuth,
    gradeLabel = xPlayer.job.grade_label,
    duty = xPlayer.job.onduty
  })
  cache:set('playerLoaded', true)
end)

RegisterNetEvent('esx:setJob', function(job)
  cache:set('job', {
    name = job.name,
    type = job.type,
    label = job.label,
    grade = job.grade,
    isBoss = job.isboss,
    bankAuth = job.bankAuth,
    gradeLabel = job.grade_label,
    duty = job.onduty
  })
end)