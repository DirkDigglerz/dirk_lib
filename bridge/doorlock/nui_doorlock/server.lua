-- nui_doorlock server bridge. Manual-mode only — nui_doorlock manages doors
-- via its own UI / config; runtime addDoor isn't part of its public surface.
-- Consumers must pre-add the door in nui_doorlock and pass its existing id
-- here as spec.externalId.

local M = {}

M.register = function(spec)
  if not spec.externalId then
    lib.print.warn(('[bridge:nui_doorlock] door %s has no externalId — nui_doorlock requires the door to exist in its own config first. Add it via the nui_doorlock UI and pass that id as `externalId`.'):format(spec.id))
    return nil
  end
  pcall(function()
    exports['nui_doorlock']:setDoorState(spec.externalId, spec.locked and true or false)
  end)
  return spec.externalId
end

M.setLocked = function(spec, locked)
  local backendId = spec._backendId or spec.externalId
  if not backendId then return end
  pcall(function()
    exports['nui_doorlock']:setDoorState(backendId, locked and true or false)
  end)
end

M.setAuth = function(_spec, _auth)
  lib.print.warn('[bridge:nui_doorlock] setAuth not supported — nui_doorlock evaluates auth from its own UI/config. Manage allowed groups/items there, or use lib.doorlock.setLocked() based on your own auth checks.')
end

M.unregister = function(_spec)
  -- nui_doorlock entries are managed externally; don't touch.
end

return M
