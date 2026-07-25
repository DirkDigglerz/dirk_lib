local cachedItems

-- Cached player_vehicles column set — QB forks differ on which columns exist
-- (state / fuel / engine / body / drivingdistance…). lib.garage inserts only
-- what's present so it can't die on a missing column across QB variants.
local playerVehicleCols
local function playerVehicleColumns()
  if playerVehicleCols then return playerVehicleCols end
  playerVehicleCols = {}
  local ok, rows = pcall(function()
    return exports.oxmysql:query_async(
      "SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'player_vehicles'")
  end)
  if ok and type(rows) == 'table' then
    for _, r in ipairs(rows) do
      local col = r.c or r.COLUMN_NAME
      if col then playerVehicleCols[col] = true end
    end
  end
  return playerVehicleCols
end

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

  --- Look up a single item's record by name. QBCore exposes Shared.Items
  --- as a plain table — direct hash access, no walk.
  ---@param name string
  ---@return table?
  item = function(name)
    local src = lib.FW and lib.FW.Shared and lib.FW.Shared.Items
    if not src then return nil end
    return src[name]
  end,

  canUseItem = function(item)
    local itemInfo = lib.FW.Functions.CanUseItem(item)
    if type(itemInfo) ~= 'table' then
      return false
    end

    if not itemInfo.func then 
      return false
    end

    return itemInfo.func 
  end,

  useableItem = function(item, cb)
    return lib.FW.Functions.CreateUseableItem(item,cb)
  end,

  --- Store a vehicle in the player's garage (QB player_vehicles). Schema-aware:
  --- writes citizenid/plate/vehicle/hash/mods plus whichever of license/garage/
  --- state/fuel/engine/body the table actually has. Marks state=1 (garaged).
  --- Backs lib.garage.addVehicle.
  ---@param src number
  ---@param opts { model: string, plate: string, props?: table, garage?: string, owner?: string, license?: string }
  ---@return string|false plate on success, false + reason otherwise
  addVehicle = function(src, opts)
    opts = opts or {}
    local citizenid = opts.owner or (src and lib.player.identifier(src))
    local plate = opts.plate
    if not citizenid or not plate then return false, 'MissingOwnerOrPlate' end
    local model = opts.model
    local mods = type(opts.props) == 'table' and json.encode(opts.props)
      or (type(opts.props) == 'string' and opts.props) or '{}'

    local cols = playerVehicleColumns()
    local fields  = { 'citizenid', 'plate', 'vehicle', 'hash', 'mods' }
    local holders = { '?', '?', '?', '?', '?' }
    local values  = { citizenid, plate, model, model and joaat(model) or 0, mods }
    local function maybe(col, val)
      if cols[col] and val ~= nil then
        fields[#fields + 1] = col
        holders[#holders + 1] = '?'
        values[#values + 1] = val
      end
    end
    maybe('license', opts.license)
    maybe('garage', opts.garage)
    maybe('state', 1)
    maybe('fuel', 100)
    maybe('engine', 1000.0)
    maybe('body', 1000.0)

    local query = ('INSERT INTO player_vehicles (%s) VALUES (%s)'):format(
      table.concat(fields, ', '), table.concat(holders, ', '))
    local ok, err = pcall(function() return exports.oxmysql:query_async(query, values) end)
    if not ok then
      lib.print.error(('lib.garage.addVehicle (qb): %s'):format(tostring(err)))
      return false, 'InsertFailed'
    end
    return plate
  end,

  get = function(src)
    return lib.FW.Functions.GetPlayer(src)
  end,

  identifier = function(src)
    local ply = lib.player.get(src)
    if not ply then return nil end
    return ply.PlayerData.citizenid
  end, 

  name = function(src)
    local ply = lib.player.get(src)
    if not ply then return nil end
    return ply.PlayerData.charinfo.firstname, ply.PlayerData.charinfo.lastname
  end,

  phoneNumber = function(src)
    local ply = lib.player.get(src)
    if not ply then return nil end
    return ply.PlayerData.charinfo.phone
  end, 

  gender = function(src)
    local ply = lib.player.get(src)
    if not ply then return nil end
    return ply.PlayerData.charinfo.gender or 'unknown'
  end, 

  deleteCharacter = function(src, citizenId)
    return lib.FW.Player.DeleteCharacter(src, citizenId)
  end,

  loginCharacter = function(src, citizenId, slot)
    return lib.FW.Player.Login(src, citizenId)
  end,

  createCharacter = function(src, newData)
    return lib.FW.Player.Login(src, nil, {
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
    return lib.FW.Player.Logout(src, citizenId)
  end,

  getCharacters = function(src)
    local license = lib.player.getIdentifierType(src, lib.settings.primaryIdentifier or 'license')
    local toRet = {}
    -- On a relog the identifier can momentarily be unavailable. Bail to an empty
    -- list rather than querying with a nil param (returns nothing / errors) — and
    -- warn so a real "no identifier" cause is visible in the console.
    if not license then
      lib.print.warn(('[getCharacters] no %s identifier for src %s — returning no characters'):format(lib.settings.primaryIdentifier or 'license', tostring(src)))
      return toRet
    end
    local result = exports.oxmysql:query_async('SELECT * FROM players WHERE license = ?', {license})
    for k,v in pairs(result or {}) do
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
      isBoss     = rawJob.grade.isboss,
      bankAuth   = rawJob.bankAuth,
      gradeLabel = rawJob.grade.name,
      duty       = rawJob.onduty
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
    if _key then
      return ply.PlayerData[_key]
    end
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

  ---@param src number
  ---@return table<string, number> every account and its balance
  getAccounts = function(src)
    local ply = lib.player.get(src)
    if not ply then return {} end
    local out = {}
    for name, amount in pairs(ply.PlayerData.money or {}) do
      out[name] = amount or 0
    end
    return out
  end,

  ---@param identifier string citizenid
  ---@return number|nil server id, or nil when they're offline
  getSourceFromIdentifier = function(identifier)
    local ply = lib.FW.Functions.GetPlayerByCitizenId(identifier)
    return ply and ply.PlayerData and ply.PlayerData.source or nil
  end,

  addMoney = function(src, acc, count, reason)
    local ply = lib.player.get(src)
    if not ply then return end
    return ply.Functions.AddMoney(acc, count, reason)
  end, 

  removeMoney = function(src, acc, count, reason, force)
    local ply = lib.player.get(src)
    if not ply then return end
    if not force then
      local has = ply.Functions.GetMoney(acc)
      if has < count then return false, 'not_enough' end
    end
    return ply.Functions.RemoveMoney(acc, count, reason)
  end,

  setMoney = function(src, acc, count)
    local ply = lib.player.get(src)
    if not ply then return end
    return ply.Functions.SetMoney(acc, count)
  end, 

  hasLicense = function(src, license)
    if not license then return true; end 
    local licenses = lib.player.getMetadata(src, 'licenses')
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

  getLicenses = function(src)
    return lib.player.getMetadata(src, 'licenses')
  end, 

  hasGroup = function(src, group)
    return lib.hasGroup(lib.player.getJob(src), lib.player.getGang(src), group)
  end,

  -- Normalised list of every registered job. See lib.framework for the
  -- consumer-facing API; this is the per-bridge implementation.
  getJobs = function()
    local jobs = lib.FW and lib.FW.Shared and lib.FW.Shared.Jobs or {}
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
          bankAuth = g.isboss == true, -- QB has no native bankAuth
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
    local gangs = lib.FW and lib.FW.Shared and lib.FW.Shared.Gangs or {}
    local result = {}
    for name, g in pairs(gangs) do
      local grades = {}
      for gKey, gr in pairs(g.grades or {}) do
        grades[#grades + 1] = {
          grade    = tonumber(gKey) or 0,
          name     = gr.name or '',
          label    = gr.name or '',
          payment  = nil, -- gangs don't pay in QB
          isBoss   = gr.isboss == true,
          bankAuth = gr.isboss == true,
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
-- Normalised player listing for admin UIs (player pickers etc.). See
-- modules/scriptConfig/admin/tools/players.lua for the NUI-facing wrapper
-- and lib.framework.getOnlinePlayers / searchPlayers for the public API.
--
-- Shape returned by both:
--   { id = src|nil, citizenId = string, name = string, charName = string, online = boolean }

local function qbCharName(charinfo)
  charinfo = type(charinfo) == 'string' and (json.decode(charinfo) or {}) or (charinfo or {})
  local first = charinfo.firstname or ''
  local last  = charinfo.lastname  or ''
  return (first .. ' ' .. last):gsub('^%s+', ''):gsub('%s+$', '')
end

bridge.getOnlinePlayers = function()
  local result = {}
  local players = lib.FW.Functions.GetPlayers() or {}
  for i = 1, #players do
    local src = players[i]
    local ply = lib.FW.Functions.GetPlayer(src)
    if ply then
      result[#result + 1] = {
        id        = src,
        citizenId = ply.PlayerData.citizenid,
        name      = GetPlayerName(src) or '',
        charName  = qbCharName(ply.PlayerData.charinfo),
        online    = true,
      }
    end
  end
  return result
end

bridge.searchPlayers = function(opts)
  opts = opts or {}
  local rawSearch = opts.search or ''
  local limit = math.min(tonumber(opts.limit) or 50, 50)
  local searchLike = '%' .. rawSearch:lower() .. '%'

  -- Snapshot currently-online citizenids so we can flag rows accordingly.
  local onlineByCitizen = {}
  for _, p in ipairs(bridge.getOnlinePlayers()) do
    onlineByCitizen[p.citizenId] = p.id
  end

  -- Search the persistent players table (qb stores charinfo as JSON).
  -- LIKE on JSON_EXTRACT covers first/last name; we also look at citizenid
  -- and account name directly. LIMIT capped at 50 to keep response small.
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
      charName  = qbCharName(row.charinfo),
      online    = onlineByCitizen[row.citizenid] ~= nil,
    }
  end
  return result
end

if lib.onSettings then
  lib.onSettings('itemImgPath', function() cachedItems = nil end)
end

return bridge


