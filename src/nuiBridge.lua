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
  -- Test suites: which scripts have one, and running one on request.
  RegisterNuiCallback('GET_TEST_INDEX', function(data, cb)
    CreateThread(function()
      local ok, success, _err, found = pcall(lib.callback.await, 'dirk_lib:getTestIndex', {
        resources = type(data) == 'table' and data.resources or {},
      })
      cb({ resources = (ok and success and type(found) == 'table') and found or {} })
    end)
  end)

  RegisterNuiCallback('GET_TEST_STATE', function(data, cb)
    CreateThread(function()
      local ok, success, _err, state = pcall(lib.callback.await, 'dirk_lib:getTestState', {
        resource = type(data) == 'table' and data.resource or nil,
      })
      cb((ok and success and type(state) == 'table') and state or { ran = false })
    end)
  end)

  RegisterNuiCallback('RUN_TESTS', function(data, cb)
    CreateThread(function()
      local resource = type(data) == 'table' and data.resource or nil
      if type(resource) ~= 'string' or resource == '' then
        cb({ ok = false, _error = 'BadRequest' })
        return
      end

      -- Answered by the SCRIPT, not by dirk_lib: the registry is per-VM.
      local ok, success, err, result = pcall(lib.callback.await, ('%s:test:run'):format(resource), {
        filter = type(data) == 'table' and data.filter or nil,
      })

      if not ok or not success or type(result) ~= 'table' then
        cb({ ok = false, _error = (ok and err) or 'CallbackFailed' })
        return
      end
      cb({ ok = true, result = result })
    end)
  end)

  -- Changelogs, read straight out of each resource's own CHANGELOG.md.
  RegisterNuiCallback('GET_CHANGELOG', function(data, cb)
    CreateThread(function()
      local ok, success, err, payload = pcall(lib.callback.await, 'dirk_lib:getChangelog', {
        resource = type(data) == 'table' and data.resource or nil,
      })
      if not ok or not success then
        cb({ ok = false, _error = (ok and err) or 'CallbackFailed' })
        return
      end
      cb({ ok = true, text = payload and payload.text or '', version = payload and payload.version or nil })
    end)
  end)

  RegisterNuiCallback('GET_CHANGELOG_INDEX', function(data, cb)
    CreateThread(function()
      local ok, success, _err, found = pcall(lib.callback.await, 'dirk_lib:getChangelogIndex', {
        resources = type(data) == 'table' and data.resources or {},
      })
      cb({ resources = (ok and success and type(found) == 'table') and found or {} })
    end)
  end)

  -- World position, for any coordinate control in the panel.
  --
  -- dirk-cfx-react's Vector4 buttons call these BY NAME with no resource
  -- scope - every script that has an admin panel registers its own pair. The
  -- Studio is dirk_lib's own page, so `fetchNui` posts here: without these the
  -- Goto and Set buttons post into nothing and silently do nothing, which is
  -- exactly how they behaved. Kept identical to the copies in dirk_fishing and
  -- dirk_druglabsv2 so a coordinate behaves the same wherever it is edited.
  RegisterNuiCallback('GET_POSITION', function(_, cb)
    local ped = PlayerPedId()
    local pos = GetEntityCoords(ped)
    cb({ x = pos.x, y = pos.y, z = pos.z, w = GetEntityHeading(ped) })
  end)

  RegisterNuiCallback('GOTO_POSITION', function(data, cb)
    cb({})
    if type(data) ~= 'table' then return end
    local x = tonumber(data.x) or 0.0
    local y = tonumber(data.y) or 0.0
    local z = tonumber(data.z) or 0.0
    local w = tonumber(data.w) or 0.0
    local ped = PlayerPedId()
    -- The ped root sits about a metre above the visual ground when standing,
    -- so drop it by one rather than arriving mid-air.
    SetEntityCoords(ped, x + 0.0, y + 0.0, z - 1.0, false, false, false, false)
    SetEntityHeading(ped, w % 360.0)
  end)

  -- Give the editor one of a script's own items.
  --
  -- Same reasoning as SPAWN_VEHICLE below: the server decides, gated on
  -- permission to edit the OWNING script, so this callback existing is not a
  -- way to hand yourself items.
  RegisterNuiCallback('GIVE_ITEM', function(data, cb)
    CreateThread(function()
      local resource = type(data) == 'table' and data.resource or nil
      local item = type(data) == 'table' and data.item or nil
      if type(resource) ~= 'string' or type(item) ~= 'string' or item == '' then
        cb({ success = false, _error = 'BadRequest' })
        return
      end

      local ok, success, err = pcall(lib.callback.await, 'dirk_lib:giveItem', {
        resource = resource,
        item = item,
        count = tonumber(data.count) or 1,
      })

      if not ok or not success then
        cb({ success = false, _error = (ok and err) or 'CallbackFailed' })
        return
      end
      cb({ success = true })
    end)
  end)

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
