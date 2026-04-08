local settings = lib.settings
local doorlockResource = settings.doorlock

local bridge
if doorlockResource and doorlockResource ~= 'NOT FOUND' then
  bridge = lib.loadBridge('doorlock', doorlockResource, 'client')
end

lib.doorlock = {
  ---Lock or unlock a door by ID.
  ---@param doorId string|number
  ---@param locked boolean
  setLock = function(doorId, locked)
    if bridge and bridge.setLock then
      bridge.setLock(doorId, locked)
    else
      lib.print.warn('[lib.doorlock] No doorlock system detected — cannot set lock state')
    end
  end,

  ---Check if a door is locked.
  ---@param doorId string|number
  ---@return boolean
  isLocked = function(doorId)
    if bridge and bridge.isLocked then
      return bridge.isLocked(doorId)
    end
    return false
  end,

  ---Toggle a door's lock state.
  ---@param doorId string|number
  toggleLock = function(doorId)
    if bridge and bridge.toggleLock then
      bridge.toggleLock(doorId)
    else
      lib.print.warn('[lib.doorlock] No doorlock system detected — cannot toggle lock')
    end
  end,
}

return lib.doorlock
