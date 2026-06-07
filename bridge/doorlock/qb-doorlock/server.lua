-- qb-doorlock server bridge. Manual-mode only — qb-doorlock is config-file
-- driven and doesn't expose a clean runtime addDoor API the way ox_doorlock
-- does, so the door must already exist in the admin's qb-doorlock config
-- and the consumer must pass its existing id as spec.externalId.
--
-- setLocked / setAuth work against that pre-existing entry via qb-doorlock's
-- server-side events. Auth rules from spec.auth are NOT mapped — qb-doorlock
-- evaluates auth from its own config, not at runtime.

local M = {}

M.register = function(spec)
  if not spec.externalId then
    lib.print.warn(('[bridge:qb-doorlock] door %s has no externalId — qb-doorlock requires the door to exist in its config first. Add it via the qb-doorlock UI / config.lua and pass that id as `externalId`.'):format(spec.id))
    return nil
  end
  -- Set the initial lock state on the pre-existing door.
  TriggerEvent('qb-doorlock:server:updateState', spec.externalId, spec.locked and true or false)
  return spec.externalId
end

M.setLocked = function(spec, locked)
  local backendId = spec._backendId or spec.externalId
  if not backendId then return end
  TriggerEvent('qb-doorlock:server:updateState', backendId, locked and true or false)
end

M.setAuth = function(_spec, _auth)
  lib.print.warn('[bridge:qb-doorlock] setAuth not supported — qb-doorlock evaluates auth from its config. Manage allowed jobs/items in qb-doorlock directly, or use lib.doorlock.setLocked() based on your own auth checks.')
end

M.unregister = function(_spec)
  -- Doors in qb-doorlock are config entries; we never own them so there's
  -- nothing to remove. Leaving the externalId entry intact is the right move.
end

return M
