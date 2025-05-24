local cache = _ENV.cache
cache.playerId = PlayerId()
cache.serverId = GetPlayerServerId(cache.playerId)


local function deepEqual(a, b)
  if a == b then return true end
  if type(a) ~= "table" or type(b) ~= "table" then return false end

  for k, v in pairs(a) do
    if not deepEqual(v, b[k]) then
      return false
    end
  end
  for k in pairs(b) do
    if a[k] == nil then
      return false
    end
  end

  return true
end

function cache:set(key, value)
  local current = self[key]
  local isDifferent = type(value) == "table" and not deepEqual(current, value) or value ~= current

  if isDifferent then
    TriggerEvent(('dirk_lib:cache:%s'):format(key), value, current)
    self[key] = value
    return true
  end

  return false
end


local GetVehiclePedIsIn = GetVehiclePedIsIn
local GetPedInVehicleSeat = GetPedInVehicleSeat
local GetVehicleMaxNumberOfPassengers = GetVehicleMaxNumberOfPassengers
local GetCurrentPedWeapon = GetCurrentPedWeapon
local GetMount = GetMount
local IsPedOnMount = IsPedOnMount

CreateThread(function()
  local wait_time = 100
  while true do
    local ped = PlayerPedId()
    cache:set('ped', ped)

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

		if cache.game == 'redm' then
			local mount = GetMount(ped)
			local onMount = IsPedOnMount(ped)
			cache:set('mount', onMount and mount or false)
		end
    
    Wait(wait_time)
  end
end)

lib.cache = function(key)
  return cache[key]
end
