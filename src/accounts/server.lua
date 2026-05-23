-- Account introspection — exposes the *framework-defined* set of money
-- accounts (cash / bank / black_money / crypto / etc.) so consumers can
-- build pickers without each one re-implementing the framework detection.
--
-- Why not enumerate from a player's `PlayerData.money` keys? Because:
--   (a) requires a player to be online and loaded
--   (b) doesn't catch accounts the framework declares but the player
--       hasn't been credited any of yet (cash on a fresh char might be 0
--       and absent depending on how money is stored)
--   (c) admin needs to choose accounts BEFORE any player connects (server
--       startup config UI)
--
-- Framework-by-framework reality (based on shipped configs at writing):
--   • ESX (es_extended):   `Config.Accounts` shared. Three canonical
--     entries (money, bank, black_money). Server owners commonly extend.
--     We read via the shared object's GetConfig() since Config isn't
--     globally accessible from outside the resource's VM.
--   • qb-core:             `QBCore.Config.Money.MoneyTypes` map. Keys are
--     account names, values are starting amounts. Always exposed.
--   • qbx_core:            `moneyTypes` lives in `config/server.lua` which
--     is NOT in the manifest files{} block — can't be read by other
--     resources. We fall back to the QBox default trio (cash/bank/crypto).
--   • nd-framework:        Hardcoded cash + bank only in player.lua; any
--     other account string is rejected. Return the fixed pair.
--   • unknown / no framework: return an empty list with framework='unknown'
--     so the picker shows "no accounts available, type manually".
--
-- Cache: lightweight 60s TTL since Config.Accounts is essentially static
-- (changes only on framework restart).

local CACHE_TTL = 60 * 1000
local cached = nil  -- { value, expiresAt }

local function cachePut(value)
  cached = { value = value, expiresAt = GetGameTimer() + CACHE_TTL }
end

local function cacheGet()
  if not cached then return nil end
  if GetGameTimer() > cached.expiresAt then return nil end
  return cached.value
end

local function detectFramework()
  -- lib.settings.framework comes from dirk_lib's bridging settings —
  -- either explicit ('es_extended', 'qbx_core', etc.) or 'auto' resolved
  -- to whichever framework actually started.
  if not lib or not lib.settings then return 'unknown' end
  local fw = lib.settings.framework
  if fw and fw ~= 'auto' and fw ~= '' then return fw end
  -- Probe started resources for the canonical names.
  for _, name in ipairs({ 'es_extended', 'qbx_core', 'qb-core', 'ND_Core', 'nd-framework' }) do
    if GetResourceState(name) == 'started' then
      return name == 'ND_Core' and 'nd-framework' or name
    end
  end
  return 'unknown'
end

local function esxAccounts()
  -- es_extended exposes its shared object via export. GetConfig().Accounts
  -- is the live config table — server owners may have extended it.
  local ok, ESX = pcall(function() return exports.es_extended:getSharedObject() end)
  if not ok or type(ESX) ~= 'table' then return nil end
  local cfg = ESX.GetConfig and ESX.GetConfig() or nil
  local accts = cfg and cfg.Accounts or nil
  if type(accts) ~= 'table' then return nil end
  local out = {}
  for name, def in pairs(accts) do
    out[#out + 1] = {
      name  = name,
      label = type(def) == 'table' and def.label or nil,
      round = type(def) == 'table' and def.round or nil,
    }
  end
  table.sort(out, function(a, b) return a.name < b.name end)
  return out
end

local function qbCoreAccounts()
  local ok, QBCore = pcall(function() return exports['qb-core']:GetCoreObject() end)
  if not ok or type(QBCore) ~= 'table' then return nil end
  local money = QBCore.Config and QBCore.Config.Money or nil
  local moneyTypes = money and money.MoneyTypes or nil
  if type(moneyTypes) ~= 'table' then return nil end
  local out = {}
  for name, startAmt in pairs(moneyTypes) do
    out[#out + 1] = {
      name = name,
      default = type(startAmt) == 'number' and startAmt or nil,
    }
  end
  table.sort(out, function(a, b) return a.name < b.name end)
  return out
end

local function qbxAccounts()
  -- qbx_core's moneyTypes is in `config/server.lua` and NOT in the
  -- manifest's files{} block, so it can't be read cross-VM directly.
  --
  -- Workaround: read the keys off any online player's PlayerData.money —
  -- qbx_core seeds that map from moneyTypes at character load, so the
  -- keys match the configured set including any custom accounts the
  -- server owner added. Picks the first online player, snapshot their
  -- money table's keys, return as account list.
  --
  -- If nobody is online yet we fall back to the QBox-default trio.
  -- This still serves a useful picker pre-launch; the moment a player
  -- joins, the next refresh sees the full configured list.
  local fallback = {
    { name = 'cash' },
    { name = 'bank' },
    { name = 'crypto' },
  }

  local players = GetPlayers()
  if not players or #players == 0 then return fallback end

  for _, src in ipairs(players) do
    local ok, player = pcall(function() return exports.qbx_core:GetPlayer(tonumber(src)) end)
    if ok and type(player) == 'table' then
      local money = player.PlayerData and player.PlayerData.money
      if type(money) == 'table' then
        local names = {}
        for k in pairs(money) do names[#names + 1] = k end
        if #names > 0 then
          table.sort(names)
          local out = {}
          for _, n in ipairs(names) do out[#out + 1] = { name = n } end
          return out
        end
      end
    end
  end

  return fallback
end

local function ndAccounts()
  -- Hardcoded in ND_Core's player.lua — server rejects any account that
  -- isn't 'cash' or 'bank'. Don't offer anything else.
  return {
    { name = 'cash' },
    { name = 'bank' },
  }
end

local function buildList()
  local framework = detectFramework()
  local accounts

  if framework == 'es_extended' then
    accounts = esxAccounts()
  elseif framework == 'qb-core' then
    accounts = qbCoreAccounts()
  elseif framework == 'qbx_core' then
    accounts = qbxAccounts()
  elseif framework == 'nd-framework' then
    accounts = ndAccounts()
  end

  return {
    ok        = accounts ~= nil,
    framework = framework,
    accounts  = accounts or {},
  }
end

local function list()
  local hit = cacheGet()
  if hit then return hit end
  local fresh = buildList()
  cachePut(fresh)
  return fresh
end

-- Cross-resource export — same pattern as discord_* exports above.
exports('accounts_list', function() return list() end)
exports('accounts_clearCache', function() cached = nil end)
