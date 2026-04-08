return {
  setLock = function(doorId, locked)
    exports['nui_doorlock']:setDoorState(doorId, locked)
  end,

  isLocked = function(doorId)
    return exports['nui_doorlock']:getDoorState(doorId)
  end,

  toggleLock = function(doorId)
    local state = exports['nui_doorlock']:getDoorState(doorId)
    exports['nui_doorlock']:setDoorState(doorId, not state)
  end,
}
