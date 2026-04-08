return {
  setLock = function(doorId, locked)
    TriggerServerEvent('qb-doorlock:server:updateState', doorId, locked)
  end,

  isLocked = function(doorId)
    -- qb-doorlock doesn't expose a client getter easily; assume unlocked
    return false
  end,

  toggleLock = function(doorId)
    TriggerServerEvent('qb-doorlock:server:toggleDoor', doorId)
  end,
}
