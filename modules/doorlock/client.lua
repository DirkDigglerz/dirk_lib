-- lib.doorlock (client-side) — read-only mirror + in-world picker.
--
-- All mutations (register / setLocked / setAuth / unregister) are SERVER-
-- ONLY. Consumers run their auth checks server-side and then call the
-- server API directly — no client-trusted lock toggles. The client side
-- exists for two things only:
--   1. lib.doorlock.pick()    — an in-world door picker for admin UIs
--   2. lib.doorlock.cancel()  — external cancel for any in-flight pick
--   3. lib.doorlock.list()    — read-only inspection via server callback

-- Module-level handle to the active picker's finish() closure. nil when
-- no picker is running. Exposed via lib.doorlock.cancel() so external
-- callers (e.g. an admin tool watching for its invoking consumer
-- resource to stop) can force-resolve the pick with nil.
local activeCancel = nil

-- Interactive door picker. Spawns an in-world prompt that highlights the
-- entity the admin is currently aiming at; on confirm returns the door's
-- identifying info so an admin UI can hand it to lib.doorlock.register
-- (server-side) without typing model hashes by hand.
--
-- Yields. Returns { entity, model, coords, heading, isDoor } on confirm,
-- or nil on cancel. `isDoor` is true when IsEntityADoor() flags the entity
-- as a real door (most MLO doors are real props that still lock/unlock
-- fine under ox_doorlock, so we don't gate on this — just surface it).
--
-- options.showPrompt = false suppresses the built-in InstructionPanel
-- card — use that when a consumer's own React tree is already driving an
-- InstructionPanel (e.g. via cfx-react's adminToolStore). Default true so
-- standalone Lua callers (devtools, non-UI scripts) get the card for free
-- via dirk_lib's always-loaded NUI overlay.
local function pickDoor(options)
  options = options or {}
  local maxDistance = tonumber(options.maxDistance) or 30.0
  local showPrompt = options.showPrompt ~= false
  -- Group cap. Door systems (ox_doorlock etc.) treat a pair as the
  -- biggest unit — admins shouldn't be selecting 3+ doors as "one door".
  local MAX_DOORS  = tonumber(options.maxDoors) or 2

  if showPrompt then
    lib.showInstructions({
      title = options.title or 'Pick Door',
      hint  = options.hint or ('Add doors (up to %d), then confirm'):format(MAX_DOORS),
      keys  = options.keys or {
        { key = 'LMB',       action = 'Toggle'  },
        { key = 'E',         action = 'Confirm' },
        { key = 'BACKSPACE', action = 'Cancel'  },
      },
    })
  end

  lib.disableControls:Add(
    24,  -- INPUT_ATTACK (LMB) — toggle in/out of group
    25,  -- INPUT_AIM (RMB) — neutralise so aim-mode doesn't shift the camera
    38,  -- INPUT_CONTEXT (E) — confirm
    257, -- INPUT_ATTACK2
    263, -- INPUT_MELEE_ATTACK1
    264, -- INPUT_MELEE_ATTACK2
    140, 141, 142, 143, -- melee light/heavy/alt/block
    199, 200 -- INPUT_FRONTEND_PAUSE / ALTERNATE
  )
  local playerId = PlayerId()

  -- Picker state. `done` flag guards the resolution path so the various
  -- exit triggers (confirm / cancel / death / resource stop) can race
  -- safely — first one to call finish() wins, all subsequent calls are
  -- no-ops. promise.new() + Citizen.Await is the dirk_lib idiom for
  -- "yield until something resolves me".
  local p          = promise.new()
  local done       = false
  local outlined   = {}
  local group      = {}     -- group[entity] = { entity, model, coords, heading }
  local groupCount = 0

  -- Single teardown. Disables every outline we've applied, hides the
  -- instruction panel, restores firing, drops disabled controls, removes
  -- our event handlers, and resolves the promise with `value`. Idempotent
  -- via the `done` guard — any exit path can call it without worrying
  -- about double-resolution.
  local deathHandler, stopHandler
  local function finish(value)
    if done then return end
    done = true
    for ent in pairs(outlined) do
      if DoesEntityExist(ent) then SetEntityDrawOutline(ent, false) end
    end
    lib.disableControls:Remove(
      24, 25, 38, 257, 263, 264, 140, 141, 142, 143, 199, 200
    )
    DisablePlayerFiring(playerId, false)
    if showPrompt then lib.hideInstructions() end
    if deathHandler then RemoveEventHandler(deathHandler); deathHandler = nil end
    if stopHandler  then RemoveEventHandler(stopHandler);  stopHandler  = nil end
    -- Clear the module-level cancel handle so a subsequent
    -- lib.doorlock.cancel() doesn't try to re-finish a dead picker.
    if activeCancel == finish then activeCancel = nil end
    p:resolve(value)
  end

  -- Publish this pick's finish as the active cancel target. If another
  -- pick was somehow active, the new one wins — caller's responsibility
  -- not to overlap picks.
  activeCancel = finish

  -- Death watcher. Player dies mid-pick → cancel.
  deathHandler = AddEventHandler('dirk_lib:cache:dead', function(isDead)
    if isDead then finish(nil) end
  end)

  -- Resource-stop watcher. Restarting the consumer or dirk_lib mid-pick
  -- would otherwise leave outlines glowing and the panel stuck — finish()
  -- scrubs everything before the VM unloads.
  stopHandler = AddEventHandler('onResourceStop', function(name)
    if name ~= cache.resource then return end
    finish(nil)
  end)

  -- Input-debounce window. When the picker is triggered via a chat
  -- command, pressing Enter to send AND any keys the admin pressed
  -- while editing the chat (especially Backspace) leak into the very
  -- next tick as 'just pressed' — causing the picker to instantly
  -- cancel before the admin can even aim. Ignore confirm/cancel inputs
  -- for the first ~250ms so those stale presses fall off.
  local startedAt = GetGameTimer()
  local INPUT_GRACE_MS = 250

  -- Raycast — mirrors ox_lib's lib.raycast.fromCamera implementation:
  --   https://github.com/overextended/ox_lib/blob/master/imports/raycast/client.lua
  -- Three things that matter:
  --   1. StartShapeTestLosProbe (not StartShapeTestRay) — los probe is
  --      what ox_doorlock relies on for door detection.
  --   2. GetFinalRenderedCamCoord / Rot — what the player actually sees
  --      (accounts for FOV / cinematic cam tweaks), not the gameplay cam.
  --   3. Poll GetShapeTestResultIncludingMaterial in a Wait(0) loop until
  --      retval ~= 1 (1 = still pending). The async test returns stale /
  --      zero results if you read it on the same frame you started it.
  -- Flag 1|16 = INCLUDE_MOVER | INCLUDE_OBJECT — ray passes through
  -- walls/world and only registers on entities (doors, props).
  local function getForwardVector(rot)
    local rx, rz = math.rad(rot.x), math.rad(rot.z)
    local cosX = math.abs(math.cos(rx))
    return vector3(-math.sin(rz) * cosX, math.cos(rz) * cosX, math.sin(rx))
  end

  -- True geometric centre of an entity in world space. GetEntityCoords
  -- returns the entity's pivot — for doors that's almost always the
  -- hinge edge, not the visual centre. Take the model's bounding-box
  -- centre and project it through the entity's transform.
  --
  -- Falls back to GetEntityCoords (pivot) when the model isn't valid or
  -- GetModelDimensions returns degenerate values — some streamed MLO
  -- doors don't have their model dimensions queryable at runtime, and
  -- returning vec3(0,0,0) from a bad calc would make the sphere render
  -- at the world origin (invisible to the admin).
  local function entityCentre(entity)
    local model = GetEntityModel(entity)
    if not model or model == 0 then return GetEntityCoords(entity) end
    local ok, min, max = pcall(GetModelDimensions, model)
    if not ok or not min or not max then return GetEntityCoords(entity) end
    local cx = (min.x + max.x) * 0.5
    local cy = (min.y + max.y) * 0.5
    local cz = (min.z + max.z) * 0.5
    return GetOffsetFromEntityInWorldCoords(entity, cx, cy, cz)
  end

  -- Dead-simple raycast. One probe, read whatever result is ready right
  -- now (may be from last frame — fine, the visual lag is invisible at
  -- 60fps). Flag 511 = INCLUDE_ALL: endCoords lands on whatever surface
  -- the crosshair is on, entityHit is the entity when one's there.
  local function castFromCamera()
    local coords      = GetFinalRenderedCamCoord()
    local forward     = getForwardVector(GetFinalRenderedCamRot(2))
    local destination = coords + forward * maxDistance
    local handle      = StartShapeTestRay(
      coords.x, coords.y, coords.z,
      destination.x, destination.y, destination.z,
      511, cache.ped, 0
    )
    local _, didHit, endCoords, _, _, entityHit = GetShapeTestResultIncludingMaterial(handle)
    if not didHit or not endCoords or (endCoords.x == 0.0 and endCoords.y == 0.0 and endCoords.z == 0.0) then
      endCoords = destination
    end
    return endCoords, entityHit or 0
  end

  -- Render+input thread. Runs every frame until finish() fires, then
  -- naturally exits because `done` is true. Doesn't fight the promise
  -- model — just polls the world and triggers state changes.
  CreateThread(function()
    -- Input-debounce window. When the picker is triggered via a chat
    -- command, pressing Enter to send AND any keys the admin pressed
    -- while editing the chat (especially Backspace) leak into the very
    -- next tick as 'just pressed' — causing the picker to instantly
    -- cancel before the admin can even aim. Ignore confirm/cancel
    -- inputs for the first ~250ms so those stale presses fall off.
    local startedAt = GetGameTimer()
    local INPUT_GRACE_MS = 250
    -- Backspace via raw VK_BACK (8) instead of INPUT_FRONTEND_CANCEL
    -- (control 177). The control-mapping layer was triggering the
    -- cancel branch on RMB on some setups — raw-key bypasses that
    -- entire system and only fires on the physical Backspace key.
    local VK_BACKSPACE = 8
    local prevBackspace = false

    while not done do
      Wait(0)
      lib.disableControls()
      DisablePlayerFiring(playerId, true)

      local aimCoords, entity = castFromCamera()
      local validEntity = entity and entity > 0
      local inGroup     = validEntity and group[entity] ~= nil

      -- Compute desired outline set for this frame: every group door +
      -- the aim target. Colours: group+aimed → RED, group+notAimed →
      -- GREEN, notGroup+aimed → WHITE. SetEntityDrawOutlineColor is
      -- documented as global per-render; setting per entity is best-
      -- effort — when the engine clobbers, the aim target's colour
      -- wins which still gives a usable state cue.
      local desired = {}
      for ent in pairs(group) do desired[ent] = true end
      if validEntity then desired[entity] = true end

      for ent in pairs(outlined) do
        if not desired[ent] then
          if DoesEntityExist(ent) then SetEntityDrawOutline(ent, false) end
          outlined[ent] = nil
        end
      end

      for ent in pairs(desired) do
        if ent ~= entity and DoesEntityExist(ent) then
          SetEntityDrawOutlineColor(56, 220, 120, 255) -- green
          SetEntityDrawOutline(ent, true)
          outlined[ent] = true
        end
      end
      if validEntity then
        if inGroup then
          SetEntityDrawOutlineColor(220, 38, 38, 255) -- red
        else
          SetEntityDrawOutlineColor(255, 255, 255, 255) -- white
        end
        SetEntityDrawOutline(entity, true)
        outlined[entity] = true
      end

      -- Aim sphere (DrawSphere — white, where the crosshair lands).
      DrawSphere(aimCoords.x, aimCoords.y, aimCoords.z, 0.15, 255, 255, 255, 220)

      -- Group centroid uses DrawMarker(28) instead of a second DrawSphere
      -- because two DrawSphere calls per frame were only rendering one of
      -- them in our setup (cause unknown — possibly a per-frame quota on
      -- the debug-sphere native). Marker(28) is the production sphere
      -- shape and supports multiple per-frame calls reliably. Visual
      -- size matched to the aim sphere via scale 0.3 (≈ radius 0.15).
      if groupCount > 0 then
        local sx, sy, sz, n = 0.0, 0.0, 0.0, 0
        for ent, door in pairs(group) do
          local pos = DoesEntityExist(ent) and entityCentre(ent) or door.coords
          if pos then
            sx = sx + pos.x; sy = sy + pos.y; sz = sz + pos.z; n = n + 1
          end
        end
        if n > 0 then
          DrawMarker(28,
            sx / n, sy / n, sz / n,
            0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            0.2, 0.2, 0.2,
            56, 220, 120, 220,
            false, true, 0, true, false, false, false)
        end
      end

      -- Inputs after grace window.
      if GetGameTimer() - startedAt > INPUT_GRACE_MS then
        -- Raw-key edge detection for Backspace cancel (avoids the RMB
        -- false-positive that control 177 was producing).
        local curBackspace = IsRawKeyPressed(VK_BACKSPACE)
        if curBackspace and not prevBackspace then
          finish(nil)
          return
        end
        prevBackspace = curBackspace

        if validEntity and IsDisabledControlJustPressed(0, 24) then
          -- LMB toggle: remove if in group, add if not (within cap).
          if inGroup then
            group[entity] = nil
            groupCount = groupCount - 1
          elseif groupCount < MAX_DOORS then
            group[entity] = {
              entity  = entity,
              model   = GetEntityModel(entity),
              coords  = GetEntityCoords(entity),
              heading = GetEntityHeading(entity),
            }
            groupCount = groupCount + 1
          else
            lib.notify({
              description = ('Max %d doors per group'):format(MAX_DOORS),
              type = 'warning',
            })
          end
        elseif IsDisabledControlJustPressed(0, 38) and groupCount > 0 then
          -- E: confirm.
          local doors = {}
          for _, door in pairs(group) do doors[#doors + 1] = door end
          finish({ doors = doors })
          return
        end
      end
    end
  end)

  return Citizen.Await(p)
end

lib.doorlock = {
  ---Interactive in-world door group picker. Yields until the admin
  ---confirms or cancels. Supports building a group of doors (e.g. a
  ---double-door pair) via repeated add/remove.
  ---
  ---Controls:
  ---  LMB        — add aimed door to the group
  ---  RMB        — remove aimed door from the group
  ---  E          — confirm and return the group
  ---  BACKSPACE  — cancel (returns nil)
  ---
  ---Outline colours: aimed door is WHITE when not in the group (LMB to
  ---add), RED when in the group (RMB to remove). Other group members
  ---show as green spheres at their position.
  ---@param options? table { maxDistance?: number }
  ---@return table|nil result { doors = { { entity, model, coords, heading }, ... } }
  pick = pickDoor,

  ---Force-cancel any in-flight pick (resolves the picker's promise
  ---with nil). Useful when the resource that triggered the pick stops
  ---mid-flow — admin tools watch their invoking consumer's
  ---onResourceStop and call this so the orphaned picker cleans up
  ---instead of waiting forever for input. No-op when no pick is
  ---running.
  cancel = function()
    if activeCancel then activeCancel(nil) end
  end,

  ---Read-only registry inspection. Round-trips to the server which owns
  ---the authoritative door list. Returns an array of door specs.
  list = function()
    return lib.callback.await('dirk_lib:doorlock:list') or {}
  end,
}

return lib.doorlock
