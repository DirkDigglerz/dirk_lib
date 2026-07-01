
local parseMetadata = function(newMetadata)
  if not newMetadata then return end
  cache:set('dead', newMetadata.isdead or newMetadata.inlaststand or IsEntityDead(cache.ped))
  cache:set('cuffed', newMetadata.ishandcuffed)
end

RegisterNetEvent('qbx_medical:client:playerRevived', function()
  cache:set('dead', false)
end)

local parseJob = function(job)
  if not job then return end
  local ret = {
    name       = job.name,
    type       = job.type,
    label      = job.label,
    grade      = job.grade.level,
    isBoss     = job.isboss,
    bankAuth   = job.bankAuth,
    gradeLabel = job.grade.name,
    duty       = job.onduty
  }
  cache:set('job', ret)
end

local parsePlayerCache = function(playerData)
  playerData =  playerData or lib.FW.Functions.GetPlayerData()
  if not playerData then return end
  if not playerData.job?.name then return end
  cache:set('citizenId', playerData.citizenid)
  cache:set('charName', playerData.charinfo.firstname..' '..playerData.charinfo.lastname)
  parseJob(playerData.job)
  parseMetadata(playerData.metadata)
  cache:set('playerLoaded', true)
end

local playerUnload = function()
  cache:set('playerLoaded', false)
  cache:set('job', {
    name = 'logged_off',
    grade = 2,
    onduty = false
  })
end

RegisterNetEvent('QBCore:Client:OnPlayerLoaded', parsePlayerCache)

RegisterNetEvent('QBCore:Client:OnPlayerUnload', playerUnload)

RegisterNetEvent('QBCore:Client:SetDuty', function(duty) 
  local originalCache = json.decode(json.encode(cache.job))
  originalCache = originalCache or {}
  originalCache.onduty = duty
  cache:set('job', originalCache)
end)

RegisterNetEvent('QBCore:Client:OnGangUpdate', function(gang) 
  cache:set('gang', gang)
end)


RegisterNetEvent('QBCore:Client:OnJobUpdate', function(job) 
  local newJob = parseJob(job)
  cache:set('job', newJob)
end)


RegisterNetEvent('QBCore:Player:SetPlayerData', function(data)
  if source == '' then return end
  if not cache.playerLoaded then return end
  parsePlayerCache(data)
end)


AddEventHandler('onResourceStart', function(resourceName)
  if lib.settings.framework ~= 'qbx_core' and lib.settings.framework ~= 'qb-core' then return end
  if resourceName == GetCurrentResourceName() then
    if not LocalPlayer.state.isLoggedIn then return end
    parsePlayerCache()
  end
end)


-- QB/qbx fire OnPlayerLoaded once. If job.name isn't resolved at that instant
-- (character select / custom ped / multicharacter race), parsePlayerCache
-- early-returns and `playerLoaded` never flips for the whole session — hanging
-- any consumer that gates on cache.playerLoaded. ESX self-heals with a poll (see
-- esxCache); QB had no equivalent. Mirror it. Idempotent: cache:set only fires
-- the change event when the value actually changes, so this is safe alongside
-- the OnPlayerLoaded / onResourceStart paths.
CreateThread(function()
  if lib.settings.framework ~= 'qb-core' and lib.settings.framework ~= 'qbx_core' then return end
  while not lib.FW do Wait(500) end
  while not lib.FW.Functions.GetPlayerData() do Wait(500) end
  while not lib.FW.Functions.GetPlayerData().job?.name do Wait(500) end
  parsePlayerCache()
end)


if lib.settings.framework ~= 'qbx_core' then return end

AddStateBagChangeHandler('isLoggedIn', ('player:%s'):format(cache.serverId), function(_, _, value)
  if value then   
    parsePlayerCache()
  else
    playerUnload()
  end
end)

RegisterNetEvent('qbx_core:client:onSetMetaData', function(meta, oldVal, val)
  if source == '' then return end
  if not cache.playerLoaded then return end
  parseMetadata()
end)