return {
  addKeys = function(src, veh, plate)

  end,  

  removeKeys = function(src, veh, plate)

  end,

  --- qb-vehiclekeys owns the lock state itself, so the native is not enough —
  --- it gets overwritten the next time the key script looks at the vehicle.
  --- Its own event is the way in, and it takes a NET id rather than a handle.
  ---
  --- A RegisterNetEvent handler answers a local TriggerEvent too, so this
  --- reaches it from the server without pretending to be a client.
  setLockState = function(veh, locked)
    TriggerEvent('qb-vehiclekeys:server:setVehLockState',
      NetworkGetNetworkIdFromEntity(veh), locked and 2 or 1)
  end,
}
