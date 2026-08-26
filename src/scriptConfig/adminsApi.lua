-- The Admins page's server side.
--
-- Managing access is MASTER ONLY, deliberately - stricter than editing
-- settings. An edit-level admin who could add rows could grant themselves
-- master-equivalent access over every script, which makes the levels
-- decorative. The master group convar is the one thing the panel cannot
-- change, and it stays that way.
--
-- Reading the list needs only view, because "who can get in here" is
-- something a moderator should be able to see about themselves.

local admins = require '@dirk_lib.src.scriptConfig.admins'

--- Players currently connected, for the add-someone picker.
---
--- Their persistent id is offered first (citizenid on qb/qbx, license on esx),
--- because that is what survives a re-connect. Raw identifiers are handed over
--- too so a server without a framework id can still name someone.
--- @param viewer number the player asking, who is left out of the list
local function onlinePlayers(viewer)
  local out = {}
  for _, id in ipairs(GetPlayers()) do
    local src = tonumber(id)
    -- Not yourself. Only a master can reach this list, and a master already
    -- has every script - a row granting yourself something lesser does
    -- nothing, and offering it just invites the question.
    if src and src ~= viewer then
      local ids = GetPlayerIdentifiers(src) or {}
      local primary
      local okId, resolved = pcall(function() return lib.player.identifier(src) end)
      if okId and type(resolved) == 'string' and resolved ~= '' then primary = resolved end
      if not primary then
        for i = 1, #ids do
          if ids[i]:sub(1, 8) == 'license:' then primary = ids[i] break end
        end
      end
      out[#out + 1] = {
        source = src,
        name = GetPlayerName(src),
        identifier = primary or ids[1],
        identifiers = ids,
        -- Already has everything via the master group, so a row for them
        -- would be a no-op. Shown rather than hidden: knowing why someone is
        -- not listable is more use than them quietly missing.
        master = exports.dirk_lib:isScriptConfigMaster(src) or nil,
      }
    end
  end
  return out
end

--- Everything the page draws in one call.
lib.callback.register('dirk_lib:getAdmins', function(source)
  if not exports.dirk_lib:canViewScriptConfig(source, 'dirk_lib') then
    return nil, 'NotAuthorized'
  end

  -- Identifiers only ever reach a master.
  --
  -- A view-level moderator may reasonably see WHO has access and at what
  -- level - that is oversight. Handing them every staff member's license is
  -- something else, and this payload crosses to a client. ACE principals are
  -- not secret (they are group names in a cfg) so those stay.
  local canManage = exports.dirk_lib:isScriptConfigMaster(source)
  local masterGroup, isDefault = ScriptConfigMasterGroup()

  local rows = {}
  local stored = admins.all()
  for i = 1, #stored do
    local row = stored[i]
    rows[i] = {
      id = row.id, kind = row.kind, name = row.name,
      subject = (canManage or row.kind == 'principal') and row.subject or nil,
      level = row.level, scripts = row.scripts,
      addedBy = row.addedBy, addedAt = row.addedAt,
    }
  end

  return {
    rows = rows,
    online = canManage and onlinePlayers(source) or {},
    -- Whether the viewer may change any of this. The page renders read-only
    -- when false rather than offering buttons that will be refused.
    canManage = canManage,
    -- Asked for rather than rebuilt here: the default lives with the access
    -- check, and a second copy of it drifts from the first.
    masterGroup = masterGroup,
    -- Whether that value was chosen or is just the fallback. The sentinel is
    -- the only way to tell - GetConvar returns the default both when it is
    -- set to that and when it is not set at all.
    masterGroupIsDefault = isDefault,
    masterGroupConvar = 'dirk_lib_master_group',
  }
end)

lib.callback.register('dirk_lib:putAdmin', function(source, payload)
  if not exports.dirk_lib:isScriptConfigMaster(source) then return false, 'NotAuthorized' end
  if type(payload) ~= 'table' then return false, 'BadPayload' end

  local ok, err = admins.put({
    kind = payload.kind, subject = payload.subject, name = payload.name,
    level = payload.level, scripts = payload.scripts,
    addedBy = GetPlayerName(source),
  })
  if not ok then return false, err end

  lib.logger.log('dirk_lib', 'admin:granted',
    ('%s granted %s access to %s'):format(
      GetPlayerName(source), payload.level or '?', payload.subject or '?'),
    { level = 'warn' })
  return true
end)

lib.callback.register('dirk_lib:removeAdmin', function(source, payload)
  if not exports.dirk_lib:isScriptConfigMaster(source) then return false, 'NotAuthorized' end
  local id = type(payload) == 'table' and payload.id or payload
  local ok, err = admins.remove(id)
  if not ok then return false, err end

  lib.logger.log('dirk_lib', 'admin:revoked',
    ('%s removed an access entry'):format(GetPlayerName(source)), { level = 'warn' })
  return true
end)
