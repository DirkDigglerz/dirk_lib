-- lib.positionEntity — spawn an entity and refine its placement with the
-- gizmo. Yields until the gizmo is confirmed or cancelled, then deletes
-- the spawned entity and returns the chosen pos + rot (or nil on cancel).
--
-- Sibling of lib.placeEntity:
--   • lib.placeEntity      — raycast-from-camera placement, "aim + click"
--   • lib.positionEntity   — gizmo-based, "drag handles to position/rotate"
--
-- Use this one when the admin already has a rough coord in mind (editing
-- an existing field, refining a manage-panel offset) and wants frame-by-
-- frame precision via the gizmo widget. Use lib.placeEntity for first-
-- pass "drop it where I'm pointing" flows.
--
-- The gizmo widget renders its own bottom-right "Gizmo Controls" overlay
-- automatically (see modules/gizmo/client.lua → src/ui/client/gizmo.lua).
-- `title` / `hint` here drive an additional lib.showInstructions card so
-- the admin sees WHAT they're positioning, not just HOW to position it.

---@class PositionEntitySpec
---@field model     string             Prop model name (required).
---@field startPos? vector3|vector4    Where to spawn; defaults to ~2m in front of the player.
---@field networked? boolean           Network the entity (default false — admin-only edits don't need it).
---@field title?    string             Optional title for the bottom-right Instruction card.
---@field hint?     string             Optional hint shown under the title.

---@class PositionEntityResult
---@field pos     vector3   Final world position of the entity.
---@field rot     vector3   Final rotation in degrees (Euler order 2).
---@field heading number    Convenience: rot.z normalised to [0, 360).

---Spawn `spec.model`, gizmo-edit it, return the chosen pos+rot or nil on
---cancel. Always cleans up the spawned entity, even on error/cancel.
---@param spec PositionEntitySpec
---@return PositionEntityResult|nil
function lib.positionEntity(spec)
  if type(spec) ~= 'table' or type(spec.model) ~= 'string' or spec.model == '' then
    lib.print.warn('[lib.positionEntity] spec.model (string) is required')
    return nil
  end

  local hash = GetHashKey(spec.model)
  -- 30s mirrors druglabs' shell-load timeout. Streamed admin props
  -- (manage panels, shells, etc.) can take a moment on cold cache.
  if not lib.request.model(hash, 30000) then
    lib.print.error(('[lib.positionEntity] model failed to load: %s'):format(spec.model))
    return nil
  end

  local sp = spec.startPos
  local spawn
  if type(sp) == 'vector4' or type(sp) == 'vector3' then
    spawn = vector3(sp.x, sp.y, sp.z)
  elseif type(sp) == 'table' and sp.x and sp.y and sp.z then
    spawn = vector3(sp.x + 0.0, sp.y + 0.0, sp.z + 0.0)
  else
    -- Default: 2m forward of the player at their feet so the gizmo
    -- widget appears in front of (not on top of) the admin.
    local ped = cache.ped
    local pf  = GetEntityForwardVector(ped)
    local pp  = GetEntityCoords(ped)
    spawn = vector3(pp.x + pf.x * 2.0, pp.y + pf.y * 2.0, pp.z)
  end

  local networked = spec.networked == true
  local entity = CreateObject(hash, spawn.x, spawn.y, spawn.z, networked, true, false)
  -- Honour startPos's heading if it had one — otherwise face the player.
  local initialHeading = (type(sp) == 'vector4' or (type(sp) == 'table' and sp.w)) and (sp.w or 0.0) or GetEntityHeading(cache.ped) + 180.0
  SetEntityHeading(entity, initialHeading + 0.0)
  SetEntityCollision(entity, false, false)
  -- gizmo applies SetEntityMatrix directly each frame, so freezing is
  -- unnecessary and would actually fight the matrix updates. Leave it
  -- unfrozen so gizmo's drags land instantly.
  SetEntityHasGravity(entity, false)

  SetModelAsNoLongerNeeded(hash)

  if type(spec.title) == 'string' and spec.title ~= '' then
    lib.showInstructions({
      title = spec.title,
      hint  = spec.hint,
    })
  end

  local ok, gizmoResult = pcall(lib.gizmo, entity)
  lib.hideInstructions()

  if not ok then
    lib.print.error(('[lib.positionEntity] gizmo errored: %s'):format(tostring(gizmoResult)))
    if DoesEntityExist(entity) then DeleteEntity(entity) end
    return nil
  end

  if not gizmoResult then
    -- Cancelled — gizmo reverted the entity to its original pos/rot
    -- before returning; we just delete and return nil.
    if DoesEntityExist(entity) then DeleteEntity(entity) end
    return nil
  end

  local pos = gizmoResult.pos
  local rot = gizmoResult.rot
  if DoesEntityExist(entity) then DeleteEntity(entity) end

  return {
    pos     = pos,
    rot     = rot,
    heading = ((rot and rot.z) or 0.0) % 360.0,
  }
end

-- Slash command for dev/quick test:
--   /positionEntity prop_name
-- Spawns the prop at ~2m in front of you, gizmo-edit, prints the result
-- to F8 and copies it to the clipboard as a vector4(x,y,z,heading).
RegisterCommand('positionEntity', function(_, args)
  local model = args[1]
  if not model then
    lib.notify({ description = 'Usage: /positionEntity <model>', type = 'error' })
    return
  end
  CreateThread(function()
    local result = lib.positionEntity({
      model = model,
      title = 'Position Entity',
      hint  = ('Model: %s'):format(model),
    })
    if not result then
      lib.notify({ description = 'positionEntity cancelled', type = 'warning' })
      return
    end
    local fmt = ('vector4(%.4f, %.4f, %.4f, %.2f)'):format(
      result.pos.x, result.pos.y, result.pos.z, result.heading
    )
    print('[positionEntity] ' .. fmt)
    pcall(lib.copyToClipboard, fmt)
    lib.notify({ description = 'Position copied to clipboard', type = 'success' })
  end)
end)
