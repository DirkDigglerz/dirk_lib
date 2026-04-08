return {
  setLock = function(doorId, locked)
    exports.ox_doorlock:setDoorState(doorId, locked and 1 or 0)
  end,

  isLocked = function(doorId)
    local state = exports.ox_doorlock:getDoorState(doorId)
    return state == 1
  end,

  toggleLock = function(doorId)
    local state = exports.ox_doorlock:getDoorState(doorId)
    exports.ox_doorlock:setDoorState(doorId, state == 1 and 0 or 1)
  end,
}
