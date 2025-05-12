local cache = _ENV.cache
cache.playerId = PlayerId()
cache.serverId = GetPlayerServerId(cache.playerId)


function cache:set(key,value)
  if value ~= self[key] then
    TriggerEvent(('dirk_lib:cache:%s'):format(key), value, self[key])
    self[key] = value
    return true
  end
  return false
end



local GetVehiclePedIsIn = GetVehiclePedIsIn
local GetPedInVehicleSeat = GetPedInVehicleSeat
local GetVehicleMaxNumberOfPassengers = GetVehicleMaxNumberOfPassengers
local GetCurrentPedWeapon = GetCurrentPedWeapon


CreateThread(function()
  local wait_time = 100
  while true do
    local ped = PlayerPedId()
    local dead = IsEntityDead(ped)
    cache:set('ped', ped)
    cache:set('dead', dead)

    local vehicle = GetVehiclePedIsIn(ped, false)
    if vehicle > 0 then
      cache:set('vehicle', vehicle)
      if not cache.seat or GetPedInVehicleSeat(vehicle, cache.seat) ~= ped then
        local max_seats = GetVehicleMaxNumberOfPassengers(vehicle)
        for i = -1, max_seats do
          if GetPedInVehicleSeat(vehicle, i) == ped then
            cache:set('seat', i)
            cache:set('driver', i == -1)
            break
          end
        end
      end
    else
      cache:set('vehicle', false)
      cache:set('seat', false)
    end

    local armed, weapon = GetCurrentPedWeapon(ped)
    cache:set('weapon', armed and weapon or false)

    Wait(wait_time)
  end
end)

lib.cache = function(key)
  return cache[key]
end
