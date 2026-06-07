-- ox_doorlock server bridge. Wraps the export surface that ox_doorlock
-- exposes for runtime door management. See:
-- https://overextended.dev/ox_doorlock/Functions/Server
--
-- Public exports we lean on:
--   exports.ox_doorlock:addDoor(coords | id, data) -> number id
--   exports.ox_doorlock:removeDoor(id)
--   exports.ox_doorlock:setDoorState(id, state)         -- 0 unlocked / 1 locked
--   exports.ox_doorlock:editDoor(id, data)              -- partial update
--
-- ox_doorlock represents auth as { groups = ..., items = ..., characters = ...}.
-- We map our spec.auth.groups/items/citizenIds into that shape.

local function toOxAuth(auth)
  if type(auth) ~= 'table' then return {} end
  local out = {}
  if auth.groups     then out.groups     = auth.groups     end
  if auth.items      then out.items      = auth.items      end
  -- ox_doorlock calls them "characters" — same idea, list of citizenids.
  if auth.citizenIds then out.characters = auth.citizenIds end
  return out
end

local function buildOxDoorData(spec)
  local data = {
    -- Required ox_doorlock fields
    coords  = spec.coords,
    heading = spec.heading or 0.0,
    model   = spec.model,
    state   = spec.locked and 1 or 0,
    -- Auth mapping
  }
  local auth = toOxAuth(spec.auth)
  for k, v in pairs(auth) do data[k] = v end
  return data
end

local M = {}

-- Register: if the spec carries an externalId, we just adopt that. Otherwise
-- we create a fresh ox_doorlock entry and remember its returned id under
-- the spec for future setLocked/unregister calls.
M.register = function(spec)
  if spec.externalId then
    -- Adopt existing door — keep its current config, just set initial lock.
    pcall(function()
      exports.ox_doorlock:setDoorState(spec.externalId, spec.locked and 1 or 0)
    end)
    return spec.externalId
  end
  local data = buildOxDoorData(spec)
  local id
  local ok, err = pcall(function()
    id = exports.ox_doorlock:addDoor(data)
  end)
  if not ok then
    lib.print.warn(('[bridge:ox_doorlock] addDoor failed for %s: %s'):format(spec.id, tostring(err)))
    return nil
  end
  return id
end

M.setLocked = function(spec, locked)
  local backendId = spec._backendId or spec.externalId
  if not backendId then return end
  exports.ox_doorlock:setDoorState(backendId, locked and 1 or 0)
end

M.setAuth = function(spec, auth)
  local backendId = spec._backendId or spec.externalId
  if not backendId then return end
  local data = toOxAuth(auth)
  exports.ox_doorlock:editDoor(backendId, data)
end

M.unregister = function(spec)
  local backendId = spec._backendId
  -- Don't remove externalId doors — they pre-exist in the admin's config
  -- and shouldn't disappear when the consumer unloads.
  if not backendId or spec.externalId then return end
  pcall(function() exports.ox_doorlock:removeDoor(backendId) end)
end

return M
