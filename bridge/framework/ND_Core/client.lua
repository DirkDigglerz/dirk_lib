--============================================================
-- ND_Core — client bridge  (written against ND_Core v2.3.2)
--
-- UNTESTED, like the server half.
--
-- ND keeps the local character in `NDCore.getPlayer()` with no source, kept up
-- to date by ND:characterLoaded / ND:updateCharacter. Everything here reads
-- through that rather than caching, because the table is replaced wholesale on
-- every update.
--============================================================

local NDCore = lib.FW

local ACCOUNT_ALIASES = { money = 'cash', cash = 'cash', bank = 'bank' }

local function me()
  return NDCore.getPlayer()
end

local bridge = {}

bridge.identifier = function()
  local ply = me()
  -- Per-character, matching the server half. `identifier` on ND is the
  -- account-level licence and is NOT what consumers mean by an identifier.
  return ply and ply.id and tostring(ply.id) or nil
end

bridge.name = function()
  local ply = me()
  if not ply then return nil end
  return ply.firstname, ply.lastname
end

bridge.getMoney = function(account)
  local ply = me()
  if not ply then return 0 end
  return ply[ACCOUNT_ALIASES[account] or account] or 0
end

bridge.getPlayerData = function(key)
  local ply = me()
  if not ply then return nil end
  if key then return ply[key] end
  return ply
end

bridge.getMetadata = function(key)
  local ply = me()
  if not ply or not ply.metadata then return nil end
  if key then return ply.metadata[key] end
  return ply.metadata
end

bridge.getJob = function()
  local ply = me()
  if not ply then return nil end

  local group = ply.groups and ply.jobInfo or nil
  return {
    name = ply.job or 'unemployed',
    type = 'job',
    label = (group and group.label) or ply.job or 'Unemployed',
    grade = (group and group.rank) or 0,
    gradeLabel = group and group.rankName,
    isBoss = (group and group.isBoss) or false,
    -- No duty concept on ND, so never gate anything off.
    duty = true,
  }
end

bridge.getGang = function()
  return { name = 'none', label = 'None', type = 'gang', grade = 0 }
end

bridge.hasGroup = function(group)
  return lib.hasGroup(bridge.getJob(), bridge.getGang(), group)
end

bridge.getLicenses = function()
  local ply = me()
  return (ply and ply.metadata and ply.metadata.licenses) or {}
end

bridge.hasLicense = function(license)
  local wanted = type(license) == 'table' and license or { license }
  for _, held in ipairs(bridge.getLicenses()) do
    if held.status == 'valid' then
      for _, want in ipairs(wanted) do
        if held.type == want then return true end
      end
    end
  end
  return false
end

bridge.editStatus = function()
  -- ND has no status/needs system of its own.
  return false
end

--- ND is ox_inventory-only and has no item registry, so items come from the
--- inventory bridge. Returned empty rather than omitted so a caller that
--- indexes these gets a table instead of nil.
bridge.items = function() return {} end
bridge.getItems = function() return {} end

return bridge
