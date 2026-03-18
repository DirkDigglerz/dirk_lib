if cache.game == 'redm' then return end

-- DataView implementation (credit: citizenfx/lua dataview.lua)
local dataview = setmetatable({
  EndBig = ">",
  EndLittle = "<",
  Types = {
    Float32 = { code = "f", size = 4 },
  },
}, {
  __call = function(_, length)
    return dataview.ArrayBuffer(length)
  end
})
dataview.__index = dataview

function dataview.ArrayBuffer(length)
  return setmetatable({
    blob = string.blob(length),
    length = length,
    offset = 1,
    cangrow = true,
  }, dataview)
end

function dataview:Buffer() return self.blob end

local function ef(big) return (big and dataview.EndBig) or dataview.EndLittle end

local function packblob(self, offset, value, code)
  local packed = self.blob:blob_pack(offset, code, value)
  if self.cangrow or packed == self.blob then
    self.blob = packed
    self.length = packed:len()
    return true
  end
  return false
end

for label, datatype in pairs(dataview.Types) do
  if not datatype.size then
    datatype.size = string.packsize(datatype.code)
  end

  dataview["Get" .. label] = function(self, offset, endian)
    offset = offset or 0
    if offset >= 0 then
      local o = self.offset + offset
      local v, _ = self.blob:blob_unpack(o, ef(endian) .. datatype.code)
      return v
    end
    return nil
  end

  dataview["Set" .. label] = function(self, offset, value, endian)
    if offset >= 0 and value then
      local o = self.offset + offset
      local v_size = (datatype.size < 0 and value:len()) or datatype.size
      if self.cangrow or ((o + (v_size - 1)) <= self.length) then
        if not packblob(self, o, value, ef(endian) .. datatype.code) then
          error("cannot grow subview")
        end
      else
        error("cannot grow dataview")
      end
    end
    return self
  end
end

local gizmoEnabled = false
local activeGizmoObj = nil
local gizmoConfirmPressed = false
local gizmoCancelPressed = false

RegisterCommand('+gizmoConfirm', function() gizmoConfirmPressed = true end, false)
RegisterCommand('-gizmoConfirm', function() end, false)
RegisterKeyMapping('+gizmoConfirm', 'Confirm gizmo editing', 'keyboard', 'RETURN')

RegisterCommand('+gizmoCancel', function() gizmoCancelPressed = true end, false)
RegisterCommand('-gizmoCancel', function() end, false)
RegisterKeyMapping('+gizmoCancel', 'Cancel gizmo editing', 'keyboard', 'BACK')

-- Controls to disable while gizmo is active (everything except camera)
local DISABLED_CONTROLS = {
  21, 24, 25, -- sprint, lmb, rmb
  36, 37,     -- stealth, select weapon
  44, 45,     -- cover, reload
  47,         -- weapon
  58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, -- ped/action controls
  73, 74, 75, -- veh enter
  140, 141, 142, 143, -- melee
  199, 200,   -- pause menus
  245,        -- chat
  249,        -- push to talk
  257, 258, 259, 260, 261, 262, -- quickselect/weapon wheel
  288, 289, 303, -- phone
  322, 323, 324, 325, 326, 327, 328, 329, 330, -- HUD/map
  344,        -- interaction
}

local function normalize(x, y, z)
  local length = math.sqrt(x * x + y * y + z * z)
  if length == 0 then return 0, 0, 0 end
  return x / length, y / length, z / length
end

local function makeEntityMatrix(entity)
  local f, r, u, a = GetEntityMatrix(entity)
  local view = dataview.ArrayBuffer(60)

  view:SetFloat32(0, r[1])
    :SetFloat32(4, r[2])
    :SetFloat32(8, r[3])
    :SetFloat32(12, 0)
    :SetFloat32(16, f[1])
    :SetFloat32(20, f[2])
    :SetFloat32(24, f[3])
    :SetFloat32(28, 0)
    :SetFloat32(32, u[1])
    :SetFloat32(36, u[2])
    :SetFloat32(40, u[3])
    :SetFloat32(44, 0)
    :SetFloat32(48, a[1])
    :SetFloat32(52, a[2])
    :SetFloat32(56, a[3])
    :SetFloat32(60, 1)

  return view
end

local function applyEntityMatrix(entity, view)
  local x1, y1, z1 = view:GetFloat32(16), view:GetFloat32(20), view:GetFloat32(24)
  local x2, y2, z2 = view:GetFloat32(0), view:GetFloat32(4), view:GetFloat32(8)
  local x3, y3, z3 = view:GetFloat32(32), view:GetFloat32(36), view:GetFloat32(40)
  local tx, ty, tz = view:GetFloat32(48), view:GetFloat32(52), view:GetFloat32(56)

  x1, y1, z1 = normalize(x1, y1, z1)
  x2, y2, z2 = normalize(x2, y2, z2)
  x3, y3, z3 = normalize(x3, y3, z3)

  SetEntityMatrix(entity,
    x1, y1, z1,
    x2, y2, z2,
    x3, y3, z3,
    tx, ty, tz
  )
end

local function clearEntityDraw(entity)
  if DoesEntityExist(entity) then SetEntityDrawOutline(entity, false) end
end

--- Gizmo editor for an entity. Yields until confirmed or cancelled.
---
--- @param entity number The entity handle to manipulate
--- @param options? table { disableControls = boolean (default true) }
--- @return table|nil { entity: number, pos: vector3, rot: vector3 } or nil if cancelled
function lib.gizmo(entity, options)
  options = options or {}
  local shouldDisable = options.disableControls ~= false

  local p = promise.new()
  activeGizmoObj = { entity = entity, close = nil }

  gizmoEnabled = true
  gizmoConfirmPressed = false
  gizmoCancelPressed = false
  EnterCursorMode()

  -- Store original position/rotation for cancel revert
  local originalPos = GetEntityCoords(entity)
  local originalRot = GetEntityRotation(entity, 2)

  -- Send real keybinds to the overlay
  local keys = {
    translate = lib.getCommandKey('+gizmoTranslation'),
    rotate = lib.getCommandKey('+gizmoRotation'),
    localWorld = lib.getCommandKey('+gizmoLocal'),
    orbit = 'ALT',
    select = lib.getCommandKey('+gizmoSelect'),
    confirm = lib.getCommandKey('+gizmoConfirm'),
    cancel = lib.getCommandKey('+gizmoCancel'),
  }
  TriggerEvent('dirk_lib:showGizmoControls', keys)

  local resetPedAlpha = false
  if IsEntityAPed(entity) then
    resetPedAlpha = true
    SetEntityAlpha(entity, 200)
  else
    SetEntityDrawOutline(entity, true)
  end

  local cancelled = false

  local function finish(cancel)
    if cancel then cancelled = true end
    gizmoEnabled = false
  end

  activeGizmoObj.close = finish

  local orbiting = false

  CreateThread(function()
    while gizmoEnabled and DoesEntityExist(entity) do
      Wait(0)

      -- Enter to confirm
      if gizmoConfirmPressed then
        gizmoConfirmPressed = false
        finish(false)
        break
      end

      -- Backspace to cancel
      if gizmoCancelPressed then
        gizmoCancelPressed = false
        finish(true)
        break
      end

      -- ALT (control 19 = INPUT_CHARACTER_WHEEL) to orbit — checked via IsDisabledControlPressed
      local altHeld = IsDisabledControlPressed(0, 19)
      if altHeld and not orbiting then
        orbiting = true
        LeaveCursorMode()
      elseif not altHeld and orbiting then
        orbiting = false
        EnterCursorMode()
      end

      -- Always disable ALT's default action (character wheel) 
      DisableControlAction(0, 19, true)

      if not orbiting then
        if shouldDisable then
          for i = 1, #DISABLED_CONTROLS do
            DisableControlAction(0, DISABLED_CONTROLS[i], true)
          end
        else
          DisableControlAction(0, 24, true)
          DisableControlAction(0, 25, true)
          DisableControlAction(0, 140, true)
        end
        DisablePlayerFiring(cache.playerId, true)

        local matrixBuffer = makeEntityMatrix(entity)
        local changed = Citizen.InvokeNative(0xEB2EDCA2, matrixBuffer:Buffer(), 'Editor1', Citizen.ReturnResultAnyway())

        if changed then
          applyEntityMatrix(entity, matrixBuffer)
        end
      end
    end

    -- Ensure cursor mode is fully cleared no matter what state we ended in
    LeaveCursorMode()
    LeaveCursorMode()
    TriggerEvent('dirk_lib:hideGizmoControls')
    clearEntityDraw(entity)
    if resetPedAlpha and DoesEntityExist(entity) then SetEntityAlpha(entity, 255) end

    -- If cancelled, revert entity to original position/rotation
    if cancelled and DoesEntityExist(entity) then
      SetEntityCoords(entity, originalPos.x, originalPos.y, originalPos.z, false, false, false, false)
      SetEntityRotation(entity, originalRot.x, originalRot.y, originalRot.z, 2, false)
    end

    local result = nil
    if not cancelled then
      result = {
        entity = entity,
        pos = DoesEntityExist(entity) and GetEntityCoords(entity) or vector3(0, 0, 0),
        rot = DoesEntityExist(entity) and GetEntityRotation(entity, 2) or vector3(0, 0, 0),
      }
    end

    activeGizmoObj = nil
    p:resolve(result)
  end)

  return Citizen.Await(p)
end

RegisterKeyMapping('+gizmoSelect', 'Selects the currently highlighted gizmo', 'MOUSE_BUTTON', 'MOUSE_LEFT')
RegisterKeyMapping('+gizmoTranslation', 'Sets mode of the gizmo to translation', 'keyboard', 'T')
RegisterKeyMapping('+gizmoRotation', 'Sets mode for the gizmo to rotation', 'keyboard', 'R')
RegisterKeyMapping('+gizmoScale', 'Sets mode for the gizmo to scale', 'keyboard', 'S')
RegisterKeyMapping('+gizmoLocal', 'Sets gizmo to be local to the entity instead of world', 'keyboard', 'L')

return lib.gizmo

-- Thanks to AvarianKnight for the gizmo code.
-- https://github.com/Andyyy7666/ox_lib/blob/master/imports/gizmo/client.lua
