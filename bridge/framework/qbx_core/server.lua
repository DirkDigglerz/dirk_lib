local cachedItems

local bridge = {
  ---@function lib.inventory.items
  ---@description # Get all items from QBCore.Shared.Items. Cached per resource lifetime.
  ---@return table<string, { name: string, label: string, weight: number, image: string }>
  items = function()
    if cachedItems then return cachedItems end
    local src = lib.FW and lib.FW.Shared and lib.FW.Shared.Items
    if not src then return {} end
    local formatted = {}
    for k, v in pairs(src) do
      formatted[k] = {
        name   = v.name or k,
        label  = v.label or v.name or k,
        weight = v.weight or 0,
        image  = lib.formatImagePath(v.image or v.name or k),
      }
    end
    cachedItems = formatted
    return formatted
  end,

  --- Look up a single item's record by name. Qbox shares the QBCore item
  --- table — direct hash access.
  ---@param name string
  ---@return table?
  item = function(name)
    local src = lib.FW and lib.FW.Shared and lib.FW.Shared.Items
    if not src then return nil end
    return src[name]
  end,

  canUseItem = function(item)
    return exports.qbx_core:CanUseItem(item)
  end,

  useableItem = function(item, cb)
    return exports.qbx_core:CreateUseableItem(item, cb)
  end,

  get = function(src)
    return exports['qbx_core']:GetPlayer(src)
  end,

  identifier = function(src)
    
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return ply.PlayerData.citizenid
  end, 

  name = function(src)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return ply.PlayerData.charinfo.firstname, ply.PlayerData.charinfo.lastname
  end,

  phoneNumber = function(src)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return ply.PlayerData.charinfo.phone
  end, 

  gender = function(src)
    local ply = lib.player.get(src)
    assert(ply, 'Player does not exist')
    return ply.PlayerData.charinfo.gender or 'unknown'
  end, 
 
  deleteCharacter = function(src, citizenId)
    return exports.qbx_core:DeleteCharacter(citizenId)
  end,

  loginCharacter = function(src, citizenId, slot)
    return exports.qbx_core:Login(src, citizenId)
  end,

  createCharacter = function(src, newData)
    return exports.qbx_core:Login(src, nil, {
      cid = newData.slot, 
      charinfo = {
        firstname = newData.firstName, 
        lastname  = newData.lastName,
        birthdate = newData.dob,
        gender    = newData.gender == 'female' and 1 or 0, 
        nationality = newData.nationallity,
      }
    })
  end,

  logoutCharacter = function(src, citizenId)
    return exports.qbx_core:Logout(src, citizenId)
  end,

  getCharacters = function(src)
    local license = lib.player.getIdentifierType(src, 'license2')
    local toRet = {}
    local result = exports.oxmysql:query_async('SELECT * FROM players WHERE license = ?', {license})
    for k,v in pairs(result) do
      local charInfo = json.decode(v.charinfo)
      local lastPos = json.decode(v.position)
      table.insert(toRet, {
        slot       = tonumber(v.cid),
        firstName  = charInfo.firstname,
        lastName   = charInfo.lastname,
        dob        = charInfo.birthdate,
        lastpos    = vector4(lastPos.x or 0.0, lastPos.y or 0.0, lastPos.z or 0.0, lastPos.w or 0.0), 
        citizenId  = v.citizenid, 
        gender     = tonumber(charInfo.gender) == 1 and 'female' or 'male',
        accounts   = json.decode(v.money) or {},
        metadata   = json.decode(v.metadata) or {},
        disabled   = v.disabled,
      })
    end
    return toRet
  end,
  
  getJob = function(src)
    local ply = lib.player.get(src)
    if not ply then return end
    local rawJob = ply.PlayerData.job
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

  getGang = function(src)
    local ply = lib.player.get(src)
    if not ply then return end
    local rawGang = ply.PlayerData.gang
    local ret = {
      name       = rawGang.name,
      type       = rawGang.type,
      label      = rawGang.label,
      grade      = rawGang.grade.level,
      isBoss     = rawGang.isboss,
      bankAuth   = rawGang.bankAuth,
      gradeLabel = rawGang.grade.name,
      duty = rawGang.onduty
    }
    return ret
  end,

  setJob = function(src, name, rank)
    local ply = lib.player.get(src)
    if not ply then return end
    ply.Functions.SetJob(name, rank)
  end,
  
  setDuty = function(src, duty)
    local ply = lib.player.get(src)
    if not ply then return end
    ply.Functions.SetJobDuty(duty)
  end,

  setPlayerData = function(src, _key, data)
    local ply = lib.player.get(src)
    if not ply then return end
    ply.Functions.SetPlayerData(_key, data)
  end,

  getPlayerData = function(src, _key)
    local ply = lib.player.get(src)
    if not ply then return end
    return ply.PlayerData
  end,

  setMetadata = function(src, _key, data)
    local ply = lib.player.get(src)
    if not ply then return end
    ply.Functions.SetMetaData(_key, data)
  end,

  getMetadata = function(src, _key)
    local ply = lib.player.get(src)
    if not ply then return end
    return ply.Functions.GetMetaData(_key)
  end,

  jail = function()

  end, 

  getMoney = function(src, acc)
    local ply = lib.player.get(src)
    if not ply then return end
    return ply.Functions.GetMoney(acc)
  end,

  addMoney = function(src, acc, amount, reason)
    local ply = lib.player.get(src)
    if not ply then return end
    return ply.Functions.AddMoney(acc, amount, reason)
  end, 

  removeMoney = function(src, acc, amount, reason, force)
    local ply = lib.player.get(src)
    if not ply then return end
    -- Check has money unless force 
    if not force then
      local has = ply.Functions.GetMoney(acc)
      if not has then return false, 'no_account' end
      if has < amount then return false, 'not_enough' end
    end
    return ply.Functions.RemoveMoney(acc, amount, reason)
  end,

  setMoney = function(src, acc, amount)
    local ply = lib.player.get(src)
    if not ply then return end
    return ply.Functions.SetMoney(acc, amount)
  end,

  hasLicense = function(src, license)
    if not license then return true; end

    -- QBX/QBCore commonly use 'licences' (British); fall back to 'licenses' if needed
    local licenses = lib.player.getMetadata and (lib.player.getMetadata(src, 'licences') or lib.player.getMetadata(src, 'licenses'))
    if not licenses then return false; end

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
    end

    return false
  end,

  getLicenses = function(src)
    return lib.player.getMetadata(src, 'licences') or lib.player.getMetadata(src, 'licenses') or {}
  end, 

  hasGroup = function(src, group)
    return lib.hasGroup(lib.player.getJob(src), lib.player.getGang(src), group)
  end,

  -- Normalised list of every registered job. qbx exposes Shared.Jobs via an
  -- export and includes the bankAuth field qb-core lacks.
  getJobs = function()
    local jobs = (type(exports.qbx_core) == 'table' and type(exports.qbx_core.GetJobs) == 'function')
      and exports.qbx_core:GetJobs()
      or (lib.FW and lib.FW.Shared and lib.FW.Shared.Jobs)
      or {}
    local result = {}
    for name, j in pairs(jobs) do
      local grades = {}
      for gKey, g in pairs(j.grades or {}) do
        grades[#grades + 1] = {
          grade    = tonumber(gKey) or 0,
          name     = g.name or '',
          label    = g.name or '',
          payment  = tonumber(g.payment) or 0,
          isBoss   = g.isboss == true,
          bankAuth = g.bankAuth == true or g.isboss == true,
        }
      end
      table.sort(grades, function(a, b) return a.grade < b.grade end)
      result[#result + 1] = {
        name        = name,
        label       = j.label or name,
        type        = 'job',
        category    = j.type,
        defaultDuty = j.defaultDuty,
        offDutyPay  = j.offDutyPay,
        grades      = grades,
      }
    end
    table.sort(result, function(a, b) return (a.label or ''):lower() < (b.label or ''):lower() end)
    return result
  end,

  getGangs = function()
    local gangs = (type(exports.qbx_core) == 'table' and type(exports.qbx_core.GetGangs) == 'function')
      and exports.qbx_core:GetGangs()
      or (lib.FW and lib.FW.Shared and lib.FW.Shared.Gangs)
      or {}
    local result = {}
    for name, g in pairs(gangs) do
      local grades = {}
      for gKey, gr in pairs(g.grades or {}) do
        grades[#grades + 1] = {
          grade    = tonumber(gKey) or 0,
          name     = gr.name or '',
          label    = gr.name or '',
          payment  = nil,
          isBoss   = gr.isboss == true,
          bankAuth = gr.bankAuth == true or gr.isboss == true,
        }
      end
      table.sort(grades, function(a, b) return a.grade < b.grade end)
      result[#result + 1] = {
        name   = name,
        label  = g.label or name,
        type   = 'gang',
        grades = grades,
      }
    end
    table.sort(result, function(a, b) return (a.label or ''):lower() < (b.label or ''):lower() end)
    return result
  end,
}

-- ── Player discovery ─────────────────────────────────────────────────────
-- See qb-core/server.lua for the contract; QBX is a QB-Core fork so the
-- `players` table schema is identical. Online listing uses qbx_core's
-- export instead of QBCore.Functions.

local function qbxCharName(charinfo)
  charinfo = type(charinfo) == 'string' and (json.decode(charinfo) or {}) or (charinfo or {})
  local first = charinfo.firstname or ''
  local last  = charinfo.lastname  or ''
  return (first .. ' ' .. last):gsub('^%s+', ''):gsub('%s+$', '')
end

bridge.getOnlinePlayers = function()
  local result = {}
  -- QBX doesn't expose its own GetPlayers export (only the singular
  -- GetPlayer). Use the FiveM-native GetPlayers() which returns string-typed
  -- source ids — tonumber them before passing to GetPlayer.
  local players = GetPlayers() or {}
  for i = 1, #players do
    local src = tonumber(players[i])
    if src then
      local ply = exports['qbx_core']:GetPlayer(src)
      if ply then
        result[#result + 1] = {
          id        = src,
          citizenId = ply.PlayerData.citizenid,
          name      = GetPlayerName(src) or '',
          charName  = qbxCharName(ply.PlayerData.charinfo),
          online    = true,
        }
      end
    end
  end
  return result
end

bridge.searchPlayers = function(opts)
  opts = opts or {}
  local rawSearch = opts.search or ''
  local limit = math.min(tonumber(opts.limit) or 50, 50)
  local searchLike = '%' .. rawSearch:lower() .. '%'

  local onlineByCitizen = {}
  for _, p in ipairs(bridge.getOnlinePlayers()) do
    onlineByCitizen[p.citizenId] = p.id
  end

  local rows = MySQL.query.await([[
    SELECT citizenid, charinfo, name
    FROM players
    WHERE LOWER(JSON_UNQUOTE(JSON_EXTRACT(charinfo, '$.firstname'))) LIKE ?
       OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(charinfo, '$.lastname'))) LIKE ?
       OR LOWER(citizenid) LIKE ?
       OR LOWER(name) LIKE ?
    LIMIT ?
  ]], { searchLike, searchLike, searchLike, searchLike, limit }) or {}

  local result = {}
  for i = 1, #rows do
    local row = rows[i]
    result[#result + 1] = {
      id        = onlineByCitizen[row.citizenid],
      citizenId = row.citizenid,
      name      = row.name or '',
      charName  = qbxCharName(row.charinfo),
      online    = onlineByCitizen[row.citizenid] ~= nil,
    }
  end
  return result
end

if lib.onSettings then
  lib.onSettings('itemImgPath', function() cachedItems = nil end)
end

return bridge