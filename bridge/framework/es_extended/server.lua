local cachedItems

-- ESX legacy uses 'money' as the cash account name. Most cross-framework
-- consumers (and our own scriptConfig defaults) pass 'cash'. Normalize so
-- whichever convention the caller uses, we resolve to whatever the player
-- actually has. If neither alias exists on the player, fall through to the
-- raw name so the caller's error path still sees the original value.
local ACCOUNT_ALIASES = {
  cash  = 'money',
  money = 'cash',
}

local function resolveAccount(ply, acc)
  if ply.getAccount(acc) then return acc end
  local alias = ACCOUNT_ALIASES[acc]
  if alias and ply.getAccount(alias) then return alias end
  return acc
end

-- Build a normalized item table from whichever ESX item source is available.
local function sourceItems()
  if not lib.FW then return nil end
  -- Newer ESX: ESX.GetItems() returns { [name] = { label, weight } }
  if type(lib.FW.GetItems) == 'function' then
    local ok, items = pcall(lib.FW.GetItems)
    if ok and type(items) == 'table' then return items end
  end
  -- Legacy ESX: ESX.Items table
  if type(lib.FW.Items) == 'table' then return lib.FW.Items end
  return nil
end

local bridge = {
  ---@function lib.inventory.items
  ---@description # Get all items from ESX. Cached per resource lifetime.
  ---@return table<string, { name: string, label: string, weight: number, image: string }>
  items = function()
    if cachedItems then return cachedItems end
    local src = sourceItems()
    if not src then return {} end
    local formatted = {}
    for k, v in pairs(src) do
      -- ESX entries vary: sometimes { label, weight }, sometimes a string label only
      local entry = type(v) == 'table' and v or { label = tostring(v) }
      formatted[k] = {
        name   = entry.name or k,
        label  = entry.label or entry.name or k,
        weight = entry.weight or 0,
        image  = lib.formatImagePath(entry.image or entry.name or k),
      }
    end
    cachedItems = formatted
    return formatted
  end,

  --- Look up a single item's record by name. ESX exposes its items as a
  --- plain table (legacy `ESX.Items` or `ESX.GetItems()`); direct hash
  --- access, no walk.
  ---@param name string
  ---@return table?
  item = function(name)
    local src = sourceItems()
    if not src then return nil end
    return src[name]
  end,

  canUseItem = function(item)
    return lib.FW.UsableItemsCallbacks[item]
  end,

  useableItem = function(item, cb)
    return lib.FW.RegisterUsableItem(item, function(src, name, item)
      cb(src, item)
    end)
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
    local raw = ply.getName() or ''
    local firstName, lastName = raw:match("^(%S+)%s+(.+)$")
    if not firstName then firstName = raw end
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
        lastpos    = vector4(v.position.x or 0.0, v.position.y or 0.0, v.position.z or 0.0, v.position.heading or 0.0), 
        citizenId  = v.identifier, 
        gender     = v.sex == 1 and 'male' or 'female',
        accounts   = json.decode(v.accounts) or {},
        metadata   = json.decode(v.metadata) or {},
        disabled   = v.disabled,
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
    local account = ply.getAccount(resolveAccount(ply, acc))
    return account and account.money or 0
  end,

  addMoney = function(src, acc, count, reason)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    ply.addAccountMoney(resolveAccount(ply, acc), count)
    return true
  end,

  removeMoney = function(src, acc, count, reason, force)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    local account = ply.getAccount(resolveAccount(ply, acc))
    if not account then return false, 'NoAccount' end
    if not force and (account.money < count) then return false, 'NotEnoughMoney' end
    ply.removeAccountMoney(resolveAccount(ply, acc), count)
    return true
  end,

  setMoney = function(src, acc, count)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    ply.setAccountMoney(resolveAccount(ply, acc), count)
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

  -- ESX has no first-class gang concept. The convention some servers follow
  -- is to flag a job's `type` field as 'gang' — we honour that to surface
  -- gangs separately, but it'll be empty on most installs. Jobs without
  -- `type='gang'` are treated as jobs.
  getJobs = function()
    local jobs = (type(lib.FW.GetJobs) == 'function' and lib.FW.GetJobs()) or lib.FW.Jobs or {}
    local result = {}
    for name, j in pairs(jobs) do
      local entry = type(j) == 'table' and j or { label = tostring(j) }
      if entry.type ~= 'gang' then
        local grades = {}
        for gKey, g in pairs(entry.grades or {}) do
          grades[#grades + 1] = {
            grade    = tonumber(g.grade or gKey) or 0,
            name     = g.name or '',
            label    = g.label or g.name or '',
            payment  = tonumber(g.salary) or 0,
            isBoss   = false, -- ESX has no native boss flag
            bankAuth = false,
          }
        end
        table.sort(grades, function(a, b) return a.grade < b.grade end)
        result[#result + 1] = {
          name        = name,
          label       = entry.label or name,
          type        = 'job',
          category    = entry.type,
          whitelisted = entry.whitelisted,
          grades      = grades,
        }
      end
    end
    table.sort(result, function(a, b) return (a.label or ''):lower() < (b.label or ''):lower() end)
    return result
  end,

  getGangs = function()
    local jobs = (type(lib.FW.GetJobs) == 'function' and lib.FW.GetJobs()) or lib.FW.Jobs or {}
    local result = {}
    for name, j in pairs(jobs) do
      local entry = type(j) == 'table' and j or {}
      if entry.type == 'gang' then
        local grades = {}
        for gKey, g in pairs(entry.grades or {}) do
          grades[#grades + 1] = {
            grade    = tonumber(g.grade or gKey) or 0,
            name     = g.name or '',
            label    = g.label or g.name or '',
            payment  = tonumber(g.salary) or 0,
            isBoss   = false,
            bankAuth = false,
          }
        end
        table.sort(grades, function(a, b) return a.grade < b.grade end)
        result[#result + 1] = {
          name   = name,
          label  = entry.label or name,
          type   = 'gang',
          grades = grades,
        }
      end
    end
    table.sort(result, function(a, b) return (a.label or ''):lower() < (b.label or ''):lower() end)
    return result
  end,

  getByPlate = function(plate)

  end,
}

if lib.onSettings then
  lib.onSettings('itemImgPath', function() cachedItems = nil end)
end

return bridge

