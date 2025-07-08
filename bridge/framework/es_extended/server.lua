return {
  canUseItem = function(item)
    return lib.FW.UsableItemsCallbacks[item]
  end,

  useableItem = function(item, cb)
    return lib.FW.RegisterUsableItem(item, cb)
  end,

  getItemLabel = function(item)
    return lib.FW.GetItemLabel(item)
  end,

  get = function(src)
    return lib.FW.GetPlayerFromId(src)
  end,

  identifier = function(src)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return ply.identifier
  end, 

  name = function(src)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    local raw = ply.getName()
    local firstName, lastName = raw:match("(%a+)%s+(.*)")
    return firstName, lastName
  end,

  phoneNumber = function(src)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    local result = exports.oxmysql:query_async("SELECT phone_number FROM users WHERE identifier = @identifier", {['@identifier'] = ply.identifier})
    return result[1] or "No Number"
  end, 

  gender = function(src)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return ply.PlayerData.charinfo.gender or 'unknown'
  end, 

  deleteCharacter = function(src, citizenId)
		local data = exports.oxmysql:query_async('SELECT * FROM users WHERE identifier LIKE ?', {'%'..citizenId..'%'})
		for k,v in pairs(data) do

			if v.identifier == citizenId then
				exports.oxmysql:query_async('DELETE FROM `users` WHERE `identifier` = ?', {v.identifier})
				break
			end
		end

    return true 
  end,

  loginCharacter = function(src, citizenId, slot)
    local rawId = lib.FW.GetIdentifier(src)
    lib.FW.Players[rawId] = true
    TriggerEvent("esx:onPlayerJoined", src, ('char%s'):format(slot))
    return true
  end,

  logoutCharacter = function(src)
    TriggerEvent("esx:playerLogout", src)
  end,

  createCharacter = function(src, data)
    local charId = ("%s%s"):format('char', data.slot)
    TriggerEvent('esx:onPlayerJoined', src, charId, {
      firstname   = data.firstName,
      lastname    = data.lastName,
      dateofbirth = data.dob,
      sex         = data.gender == 'male' and 1 or 0, 
      height      = 180,
    })
    local rawId = lib.FW.GetIdentifier(src)
    return ('%s:%s'):format(charId, rawId)
  end, 

  getCharacters = function(src)
    local toRet = {}
    local PREFIX = 'char'
    local license = lib.player.getIdentifierType(src, lib.settings.primaryIdentifier)

    if not license then
      return {}
    end

    local result = exports.oxmysql:query_async([[
      SELECT *
      FROM users 
      WHERE identifier LIKE ?
    ]], { ("%s%%%s"):format(PREFIX, license:gsub(lib.settings.primaryIdentifier .. ':', '')) })

    for k,v in pairs(result) do
      v.position = json.decode(v.position) or {}
      -- v.sex is sometimes 0 or 1 or 'm' or 'f', normalize it to 1 or 0
      
      local sex = tostring(v.sex):lower()
      v.sex = (sex == "1" or sex == "m") and 1 or 0
      local slot = v.identifier:match('char(%d+)')

      table.insert(toRet, {
        slot      = tonumber(slot),
        firstName  = v.firstname,
        lastName   = v.lastname,
        dob        = v.dateofbirth,
        disabled   = v.disabled,
        lastpos    = vector4(v.position.x or 0.0, v.position.y or 0.0, v.position.z or 0.0, v.position.heading or 0.0), 
        citizenId  = v.identifier, 
        gender     = v.sex == 1 and 'male' or 'female',
        accounts   = json.decode(v.accounts) or {},
        model      = playerSkin?.model or "mp_m_freemode_01",
        skin       = playerSkin?.skin or {},
        metadata   = json.decode(v.metadata) or {},
      })
    end
    return toRet
  end,

  getJob = function(src)
    local ply = lib.player.get(src)
    if not ply then return end
    local rawJob = ply.job
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

  getGang = function(src)
    return {
      name      = 'none',
      grade      = 0,
    }
  end,

  setJob = function(src, name, rank)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    ply.setJob(name, rank)
  end,
  
  setDuty = function(src, duty)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    ply.setJobDuty(duty)
  end,

  setPlayerData = function(src, _key, data)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    ply.Functions.SetPlayerData(_key, data)
  end,

  getPlayerData = function(src, _key)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return ply.PlayerData
  end,

  setMetadata = function(src, _key, data)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    assert(ply.setMeta, 'Player does not have setMeta function')
    return ply.setMeta(_key, data)
  end,

  getMetadata = function(src, _key)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    assert(ply.getMeta, 'Player does not have getMeta function')
    return ply.getMeta(_key)
  end,

  jail = function()

  end, 

  getMoney = function(src, acc)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return ply.getAccount(acc).money
  end,

  addMoney = function(src, acc, count, reason)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    ply.addAccountMoney(acc,count)
    return true 
  end, 

  removeMoney = function(src, acc, count, reason, force)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    local accountExists = ply.getAccount(acc)
    if not accountExists then return false, 'NoAccount' end
    if not force and (accountExists.money < count) then return false, 'NotEnoughMoney' end
    ply.removeAccountMoney(acc,count)
    return true 
  end,

  setMoney = function(src, acc, count)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    ply.setAccountMoney(acc,count)
    return true 
  end,

  hasLicense = function(src, license)
    if not license then return true; end
    local citizenId = lib.player.identifier(src)
    assert(citizenId, 'Player does not have a citizenId')

    local sql, params
    if type(license) == 'table' then
      local placeholders = {}
      for i = 1, #license do
          placeholders[i] = '?'
      end
      sql = ('SELECT 1 FROM `user_licenses` WHERE `type` IN (%s) AND `owner` = ? LIMIT 1'):format(table.concat(placeholders, ','))
      table.insert(license, citizenId)
      params = license
    else
      sql = 'SELECT 1 FROM `user_licenses` WHERE `type` = ? AND `owner` = ? LIMIT 1'
      params = { license, citizenId }
    end
    local result = exports.oxmysql:query_async(sql, params)
    return result and #result > 0
  end,

  getLicenses = function(src)
    local citizenId = lib.player.identifier(src)
    assert(citizenId, 'Player does not have a citizenId')

    local result = exports.oxmysql:query_async('SELECT * FROM user_licenses WHERE owner = ?', { citizenId })
    if not result or #result == 0 then return {} end

    local licenses = {}
    for _, license in ipairs(result) do
      licenses[license.type] = {
        name = license.name,
        label = license.label,
        status = license.status,
      }
    end
    return licenses
  end, 

  hasGroup = function(src, group)
    local myJob = lib.player.getJob(src)
    local myGang = lib.player.getGang(src)
    return lib.hasGroup(myJob, myGang, group)
  end,
}

