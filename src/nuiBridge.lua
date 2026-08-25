--- Standard NUI callbacks that any dirk_lib-powered UI can rely on.
---
--- These used to live inline in the public `init.lua`, which consumers load via
--- `@dirk_lib/init.lua`. dirk_lib itself does NOT load that file — it boots from
--- `src/init.lua` — so its own panel never got them, and the Script Studio's
--- vehicle list came back empty on a server with 900+ vehicles. One copy here,
--- required by both bootstraps, is the fix.
---
--- Client-only, and only worth registering for a resource that actually has a
--- ui_page. The caller checks both.

--- Every vehicle the framework knows, as a flat list.
---
--- Asked of the framework bridge first, so per-framework knowledge stays in
--- `bridge/framework/<name>/shared.lua`. `lib.FW.Shared.Vehicles` is the
--- fallback for a bridge that has not been taught this yet — it works for
--- anything QB-shaped, and is simply absent on ESX.
local function readVehicles(frameworkBridge)
  local raw
  if frameworkBridge and frameworkBridge.getVehicles then
    local ok, result = pcall(frameworkBridge.getVehicles)
    if ok and type(result) == 'table' then raw = result end
  end

  if not raw then
    local shared = lib.FW and lib.FW.Shared
    raw = type(shared) == 'table' and shared.Vehicles or nil
  end

  if type(raw) ~= 'table' then return {} end

  -- qb-core ships an array, qbx_core a model-keyed map. `pairs` covers both,
  -- and the key is the model when the row does not carry one.
  local out = {}
  for key, v in pairs(raw) do
    if type(v) == 'table' then
      local model = v.model or (type(key) == 'string' and key or nil)
      if model then
        out[#out + 1] = {
          model    = model,
          name     = v.name or model,
          brand    = v.brand,
          price    = v.price,
          category = v.category,
        }
      end
    end
  end
  return out
end

---@param frameworkBridge table? the already-loaded framework/shared bridge
return function(frameworkBridge)
  -- Normalised { jobs, gangs } regardless of the underlying framework. Bounced
  -- through the server because grade/label data is not all client-readable.
  RegisterNuiCallback('GET_FRAMEWORK_GROUPS', function(_, cb)
    CreateThread(function()
      local ok, data = pcall(lib.callback.await, 'dirk_lib:getFrameworkGroups')
      cb((ok and type(data) == 'table') and data or { jobs = {}, gangs = {} })
    end)
  end)

  -- Shared-vehicle list for cfx-react's useVehicles / VehicleSelect /
  -- CategorySelect, and for the Script Studio's vehicle catalogue.
  RegisterNuiCallback('GET_VEHICLES', function(_, cb)
    cb(readVehicles(frameworkBridge))
  end)

  -- "Spawn it" from the vehicle catalogue.
  --
  -- The client does NOT spawn anything. It asks the server, which checks the
  -- same permission that gates editing a config and creates the vehicle
  -- itself; all that comes back is a network id. Without permission there is
  -- no vehicle to be seated in, so this callback existing in a resource is not
  -- a way to spawn one.
  RegisterNuiCallback('SPAWN_VEHICLE', function(data, cb)
    CreateThread(function()
      local model = type(data) == 'table' and data.model or nil
      if type(model) ~= 'string' or model == '' then
        cb({ success = false, _error = 'BadModel' })
        return
      end

      local ok, success, err, result = pcall(lib.callback.await, 'dirk_lib:spawnVehicle', { model = model })
      if not ok or not success or type(result) ~= 'table' then
        cb({ success = false, _error = (ok and err) or 'CallbackFailed' })
        return
      end

      -- The server owns it; this side just waits for it to stream in before
      -- putting the player behind the wheel.
      local vehicle, tries = 0, 0
      while tries < 100 do
        vehicle = NetworkGetEntityFromNetworkId(result.netId)
        if vehicle ~= 0 and DoesEntityExist(vehicle) then break end
        Wait(10)
        tries = tries + 1
      end

      if vehicle == 0 or not DoesEntityExist(vehicle) then
        -- It exists server-side either way, so this is "you may have to walk
        -- to it", not a failure.
        cb({ success = true })
        return
      end

      SetPedIntoVehicle(PlayerPedId(), vehicle, -1)

      -- Keys go through the CLIENT bridge on purpose: every supported
      -- vehicle-keys resource implements the client half, while only
      -- wasabi_carlock implements the server one. A vehicle you cannot start is
      -- not much of a spawn.
      pcall(function()
        lib.vehicle.addKeys(vehicle, result.plate or GetVehicleNumberPlateText(vehicle))
      end)

      cb({ success = true })
    end)
  end)
end
