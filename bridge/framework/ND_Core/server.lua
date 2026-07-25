--============================================================
-- ND_Core — server bridge  (written against ND_Core v2.3.2)
--
-- UNTESTED. Written from ND_Core's source rather than its docs (the docs
-- disagree with the source in several places, and the source wins), but nobody
-- has run it against a live ND server yet. Treat behaviour as unverified.
--
-- Things about ND that this bridge has to paper over:
--
--   * Accounts are strictly `cash` and `bank` — real integer columns, not a
--     table. Any other name silently returns nil from add/deduct, so names are
--     normalised on the way in.
--   * There is no removeMoney; it is `deductMoney`. And it does NOT check the
--     balance, so it will happily push a player negative — the check here is
--     ours.
--   * There is no setMoney either; setting goes through `setData`.
--   * There is no gang concept, and no duty concept.
--   * There is no lookup by identifier, so that one loops.
--   * `player.id` is the per-character id (the citizenid equivalent);
--     `player.identifier` is the account-level licence, shared across all of
--     that player's characters. Consumers of `lib.player.identifier` expect
--     per-character, so `id` is what we return.
--   * ND is ox_inventory-only and has no item registry, so no inventory
--     functions are implemented here — dirk_lib prefers the inventory bridge
--     over the framework one anyway.
--============================================================

local NDCore = lib.FW

--- ND only knows these two. Map the common aliases onto them so a caller
--- written against ESX/QB naming still works.
local ACCOUNT_ALIASES = {
  money = 'cash',
  cash = 'cash',
  bank = 'bank',
}

local function resolveAccount(acc)
  return ACCOUNT_ALIASES[acc] or acc
end

--- Never cache an ND player table across ticks: it crosses a resource
--- boundary, so its scalar fields are a snapshot from when it was fetched.
local function getPlayer(src)
  return NDCore.getPlayer(src)
end

local bridge = {}

--============================================================
-- Identity
--============================================================

bridge.get = getPlayer

bridge.identifier = function(src)
  local ply = getPlayer(src)
  if not ply then return nil end
  -- Per-character, matching what citizenid means on QB. Stringified because
  -- ND's is a number and every consumer treats identifiers as strings.
  return ply.id and tostring(ply.id) or nil
end

bridge.name = function(src)
  local ply = getPlayer(src)
  if not ply then return nil end
  return ply.firstname, ply.lastname
end

bridge.phoneNumber = function(src)
  local ply = getPlayer(src)
  if not ply then return nil end
  -- Lowercase 'n'. ND's own backwards-compat shim exposes a DIFFERENT field
  -- (metadata.phone); the column is phonenumber.
  return ply.phonenumber or 'No Number'
end

bridge.gender = function(src)
  local ply = getPlayer(src)
  if not ply then return nil end
  -- Free-form on ND — whatever the character creator wrote. No 0/1 convention.
  return ply.gender or 'unknown'
end

bridge.getSourceFromIdentifier = function(identifier)
  if not identifier then return nil end
  local wanted = tostring(identifier)
  -- ND has no lookup by identifier: getPlayers() only filters on a fixed set of
  -- keys and treats anything else as a metadata key, silently returning {}.
  for src, ply in pairs(NDCore.getPlayers() or {}) do
    if ply and (tostring(ply.id) == wanted or ply.identifier == wanted) then
      return tonumber(src)
    end
  end
  return nil
end

--============================================================
-- Money
--============================================================

bridge.getMoney = function(src, acc)
  local ply = getPlayer(src)
  if not ply then return nil end
  return ply[resolveAccount(acc)] or 0
end

bridge.getAccounts = function(src)
  local ply = getPlayer(src)
  if not ply then return {} end
  return { cash = ply.cash or 0, bank = ply.bank or 0 }
end

bridge.addMoney = function(src, acc, count, reason)
  local ply = getPlayer(src)
  if not ply then return false end
  return ply.addMoney(resolveAccount(acc), count, reason) and true or false
end

bridge.removeMoney = function(src, acc, count, reason, force)
  local ply = getPlayer(src)
  if not ply then return false, 'NoAccount' end

  local account = resolveAccount(acc)
  -- ND's deductMoney has no balance check and will go negative, so this is the
  -- only thing standing between a caller and a player in debt.
  if not force and (ply[account] or 0) < count then
    return false, 'NotEnoughMoney'
  end

  return ply.deductMoney(account, count, reason) and true or false
end

bridge.setMoney = function(src, acc, count)
  local ply = getPlayer(src)
  if not ply then return false end
  -- No setMoney on ND; setData is the documented route and is what fires the
  -- money-changed event for a 'set'.
  ply.setData(resolveAccount(acc), count)
  return true
end

--============================================================
-- Groups (ND has jobs, but no gangs and no duty)
--============================================================

bridge.getJob = function(src)
  local ply = getPlayer(src)
  if not ply then return nil end

  local name, group = ply.getJob()
  if not name then return { name = 'unemployed', label = 'Unemployed', grade = 0 } end

  group = group or {}
  return {
    name = name,
    type = 'job',
    label = group.label or name,
    grade = group.rank or 0,
    gradeLabel = group.rankName,
    isBoss = group.isBoss or false,
    bankAuth = group.isBoss or false,
    -- ND has no duty concept at all, so everyone is always on duty rather than
    -- always off it, which would break every duty-gated feature.
    duty = true,
  }
end

bridge.getGang = function()
  -- No gang concept on ND. Same shape the ESX bridge returns for the same
  -- reason, so consumers don't have to special-case it.
  return { name = 'none', label = 'None', type = 'gang', grade = 0 }
end

bridge.setJob = function(src, name, rank)
  local ply = getPlayer(src)
  if not ply then return false end
  ply.setJob(name, rank)
  return true
end

bridge.setDuty = function()
  -- Nothing to toggle: ND has no duty flag. Stubbed rather than omitted so
  -- callers get `false` instead of indexing nil.
  return false
end

bridge.hasGroup = function(src, group)
  local job = bridge.getJob(src)
  local gang = bridge.getGang(src)
  return lib.hasGroup(job, gang, group)
end

local function allGroups(isJob)
  local out = {}
  for _, group in ipairs(NDCore.getAllGroups() or {}) do
    if (group.isJob and true or false) == isJob then
      local grades = {}
      for _, rank in ipairs(group.ranks or {}) do
        grades[#grades + 1] = {
          grade = rank.id,
          name = rank.label,
          label = rank.label,
          payment = 0,
          isBoss = rank.isBoss or false,
          bankAuth = rank.isBoss or false,
        }
      end
      out[#out + 1] = {
        name = group.name,
        label = group.label or group.name,
        type = isJob and 'job' or 'gang',
        grades = grades,
      }
    end
  end
  return out
end

bridge.getJobs = function() return allGroups(true) end
bridge.getGangs = function() return allGroups(false) end

--============================================================
-- Data / metadata / licences
--============================================================

bridge.getPlayerData = function(src, key)
  local ply = getPlayer(src)
  if not ply then return nil end
  if key then return ply.getData(key) end
  return ply
end

bridge.setPlayerData = function(src, key, data)
  local ply = getPlayer(src)
  if not ply then return nil end
  return ply.setData(key, data)
end

bridge.getMetadata = function(src, key)
  local ply = getPlayer(src)
  if not ply then return nil end
  return ply.getMetadata(key)
end

bridge.setMetadata = function(src, key, data)
  local ply = getPlayer(src)
  if not ply then return nil end
  return ply.setMetadata(key, data)
end

bridge.getLicenses = function(src)
  local ply = getPlayer(src)
  if not ply then return {} end
  return (ply.metadata and ply.metadata.licenses) or {}
end

bridge.hasLicense = function(src, license)
  local licenses = bridge.getLicenses(src)
  -- ND stores licences as an ARRAY of records, not a keyed map, so this is a
  -- scan by type. A table argument means any-of, matching the other bridges.
  local wanted = type(license) == 'table' and license or { license }
  for _, held in ipairs(licenses) do
    if held.status == 'valid' then
      for _, want in ipairs(wanted) do
        if held.type == want then return true end
      end
    end
  end
  return false
end

--============================================================
-- Characters
--============================================================

bridge.getCharacters = function(src)
  local out = {}
  for slot, char in ipairs(NDCore.fetchAllCharacters(src) or {}) do
    out[#out + 1] = {
      slot = slot,
      citizenId = char.id and tostring(char.id) or nil,
      firstName = char.firstname,
      lastName = char.lastname,
      dob = char.dob,
      gender = char.gender,
      accounts = { cash = char.cash or 0, bank = char.bank or 0 },
      metadata = char.metadata,
      disabled = false,
    }
  end
  return out
end

bridge.loginCharacter = function(src, citizenId)
  NDCore.setActiveCharacter(src, tonumber(citizenId) or citizenId)
  return true
end

bridge.logoutCharacter = function(src)
  local ply = getPlayer(src)
  if not ply then return false end
  ply.unload()
  return true
end

bridge.createCharacter = function(src, newData)
  return NDCore.newCharacter(src, newData)
end

bridge.deleteCharacter = function(src, citizenId)
  local ply = getPlayer(src)
  -- ND deletes through the character itself, and only the active one exposes
  -- delete(). Soft delete: it sets deleted_at and a cron purges after 30 days.
  if ply and tostring(ply.id) == tostring(citizenId) then
    ply.delete()
    return true
  end
  return false
end

--============================================================
-- Discovery
--============================================================

bridge.getOnlinePlayers = function()
  local out = {}
  for src, ply in pairs(NDCore.getPlayers() or {}) do
    out[#out + 1] = {
      id = tonumber(src),
      citizenId = ply.id and tostring(ply.id) or nil,
      name = ply.name,
      charName = ply.fullname,
      online = true,
    }
  end
  return out
end

bridge.searchPlayers = function(opts)
  opts = opts or {}
  local search = (opts.search or ''):lower()
  local limit = math.min(tonumber(opts.limit) or 50, 50)

  local out = {}
  for _, ply in ipairs(bridge.getOnlinePlayers()) do
    if #out >= limit then break end
    if search == ''
      or (ply.charName or ''):lower():find(search, 1, true)
      or (ply.name or ''):lower():find(search, 1, true)
      or (ply.citizenId or ''):lower():find(search, 1, true)
    then
      out[#out + 1] = ply
    end
  end
  return out
end

--============================================================
-- Not applicable on ND
--============================================================

bridge.jail = function()
  -- No jail API. Overridden by the prison bridge when one is detected.
  return false
end

return bridge
