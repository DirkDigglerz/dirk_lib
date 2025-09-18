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

  end,

  hasLicense = function(license)
    if not license then return true end

    -- QBX/QBCore commonly use 'licences' (British); fall back to 'licenses' if needed
    local licenses = lib.player.getMetadata and (lib.player.getMetadata('licences') or lib.player.getMetadata('licenses'))
    if not licenses then return false end

    local function truthy(v)
      return v == true or v == 1 or v == '1'
    end

    if type(license) == 'string' then
      local v = licenses[license]
      return truthy(v)
    elseif type(license) == 'table' then
      -- ANY-of: return true as soon as one of the requested licenses is present
      for _, name in ipairs(license) do
        local v = licenses[name]
        if truthy(v) then
          return true
        end
      end
      return false
    end

    return false
  end,

  getLicenses = function()
    return lib.player.getMetadata('licences') or lib.player.getMetadata('licenses') or {}
  end, 

  hasGroup = function(group)
    return lib.hasGroup(lib.player.getJob(), lib.player.getGang(), group)
  end,

}