return {
  --- Keys, granted by the server.
  ---
  --- qbx tracks keys by the vehicle's SESSION ID, not by its plate, so its own
  --- export is the only correct way in. The qb-compat event takes a plate and
  --- has to go looking for a vehicle that matches it, which is both slower and
  --- wrong when two vehicles share a plate.
  ---
  --- Silent on purpose: this is used mid-cinematic, and "Keys taken" popping up
  --- over a camera move reads like a bug.
  addKeys = function(src, veh, plate)
    if not veh or veh == 0 then return false end
    exports.qbx_vehiclekeys:GiveKeys(src, veh, true)
    -- Answered TRUE so a caller can tell a real grant from a bridge that has no
    -- server-side implementation and silently did nothing.
    return true
  end,

  removeKeys = function(src, veh, plate)
    if not veh or veh == 0 then return end
    exports.qbx_vehiclekeys:RemoveKeys(src, veh)
  end,

  --- qbx keeps the lock in a statebag (`doorslockstate`) and syncs it itself,
  --- so setting the native here would simply be overwritten on its next pass.
  --- Its own export writes the bag, and it also honours the per-model `noLock`
  --- and `shared` config that the native knows nothing about.
  setLockState = function(veh, locked)
    exports.qbx_vehiclekeys:SetLockState(veh, locked and 'lock' or 'unlock')
  end,
}
