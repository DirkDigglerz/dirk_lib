if lib.settings.framework ~= 'es_extended' then return end

local parsePlayerData = function(playerData)
  cache:set('dead', playerData.dead)
end

local parseJob = function(job)
  local parsedJob = {
    name = job.name,
    type = job.type,
    label = job.label,
    grade = job.grade,
    isBoss = job.isboss,
    bankAuth = job.bankAuth,
    gradeLabel = job.grade_label,
    duty = job.onduty
  }
  cache:set('job', parsedJob)
end

local parsePlayerCache = function(playerData)
  playerData = playerData or lib.FW.GetPlayerData()
  if not playerData then return end
  if not playerData.job?.name then return end
  cache:set('citizenId', playerData.identifier)
  cache:set('charName', playerData.firstName..' '..playerData.lastName)
  parseJob(playerData.job)
  parsePlayerData(playerData)
  cache:set('playerLoaded', true)
end

CreateThread(function()
  while not lib.FW do Wait(500); end 
  while not lib.FW.GetPlayerData() do Wait(500); end
  while not lib.FW.GetPlayerData().job?.name do Wait(500); end
  parsePlayerCache()
end)

RegisterNetEvent('esx:playerLoaded', function(xPlayer)
  parsePlayerCache(xPlayer)
end)

RegisterNetEvent('esx:setJob', function(job)
  parseJob(job)
end)

AddEventHandler('esx:setPlayerData', function(key, val, last)
  parsePlayerCache()
end)

RegisterNetEvent('esx:onPlayerDeath', function()
  cache:set('dead', true)
end)

RegisterNetEvent('esx_ambulancejob:revive', function()
  cache:set('dead', false)
end)

-- HANDDCUFFING CACHE

RegisterNetEvent('esx_policejob:handcuff', function()
	cache:set('cuffed', not cache.cuffed)
end)

RegisterNetEvent('esx_policejob:unrestrain', function()
  cache:set('cuffed', false)
end)