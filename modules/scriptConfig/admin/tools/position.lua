-- Position-related admin tools.
--
-- Exposes:
--   lib.adminTool.capturePosition(cb?)
--     Releases NUI focus, fades blur out, polls E (confirm) / Backspace
--     (cancel). On confirm calls cb({x,y,z,w}) and sends a NUI message
--     that resolves the React picker promise. On cancel cb(nil) and sends
--     the cancel message. cb is optional — the NUI flow works on its own.
--
--   lib.adminTool.gotoCoord({x, y, z, w})
--     Teleports the player to the given world coords. Used by the Goto
--     button next to position fields, and callable directly from Lua for
--     any admin-only "jump to coord" flow.
--
-- NUI surface (registered centrally in admin/init.lua, dispatched by id):
--   ADMIN_TOOL_BEGIN { id = 'capturePosition' }    → starts capture flow
--   ADMIN_TOOL_INVOKE { id = 'gotoCoord', value }  → teleport
--
-- React side fires SendNuiMessage events back:
--   { action = 'capturePosition_RESULT',    data = {x,y,z,w} }
--   { action = 'capturePosition_CANCELLED' }

local TOOL_ID = 'capturePosition'

local capturing = false
local captureCallback = nil

local function endCapture(success, payload)
  if not capturing then return end
  capturing = false
  SetNuiFocus(true, true)
  TriggerScreenblurFadeIn(0)
  if success then
    SendNuiMessage(json.encode({
      action = TOOL_ID .. '_RESULT',
      data = payload,
    }))
    if type(captureCallback) == 'function' then
      pcall(captureCallback, payload)
    end
  else
    SendNuiMessage(json.encode({
      action = TOOL_ID .. '_CANCELLED',
    }))
    if type(captureCallback) == 'function' then
      pcall(captureCallback, nil)
    end
  end
  captureCallback = nil
end

local function startCapture(cb)
  if capturing then return end
  capturing = true
  captureCallback = cb

  SetNuiFocus(false, false)
  TriggerScreenblurFadeOut(0)

  CreateThread(function()
    while capturing do
      Wait(0)
      -- INPUT_CONTEXT (E, 38) and INPUT_FRONTEND_CANCEL (Backspace, 177).
      -- Disable so vanilla bindings don't also fire (e.g. enter vehicle on E).
      DisableControlAction(0, 38, true)
      DisableControlAction(0, 177, true)

      if IsDisabledControlJustPressed(0, 38) then
        local ply = PlayerPedId()
        local pos = GetEntityCoords(ply)
        endCapture(true, {
          x = pos.x,
          y = pos.y,
          z = pos.z,
          w = GetEntityHeading(ply),
        })
        return
      elseif IsDisabledControlJustPressed(0, 177) then
        endCapture(false)
        return
      end
    end
  end)
end

lib.adminTool.capturePosition = function(cb)
  if not _G.__dirkLibIsAdminEditing() then
    if type(cb) == 'function' then cb(nil) end
    return
  end
  startCapture(cb)
end

lib.adminTool.gotoCoord = function(v)
  if not _G.__dirkLibIsAdminEditing() then return end
  if type(v) ~= 'table' then return end
  local x = tonumber(v.x) or 0.0
  local y = tonumber(v.y) or 0.0
  local z = tonumber(v.z) or 0.0
  local w = tonumber(v.w) or 0.0
  local ply = PlayerPedId()
  -- -1.0 z mirrors druglabs' shell-offset goto: GTA ped root sits ~1m above
  -- visual ground when standing, so subtract 1m to drop the ped to the
  -- floor instead of mid-air.
  SetEntityCoords(ply, x + 0.0, y + 0.0, z - 1.0, false, false, false, false)
  SetEntityHeading(ply, w % 360.0)
end

-- Wire the NUI dispatchers to this tool.
_G.__dirkLibAdminToolHandlers.begin[TOOL_ID] = function()
  -- React side just wants the result via SendNuiMessage; no direct cb.
  startCapture(nil)
end

_G.__dirkLibAdminToolHandlers.invoke['gotoCoord'] = function(data)
  lib.adminTool.gotoCoord(data and data.value)
end

-- Safety: if the resource stops mid-capture, restore focus so the admin
-- isn't left cursorless. NUI is gone so SendNuiMessage no-ops anyway.
AddEventHandler('onResourceStop', function(name)
  if name == GetCurrentResourceName() and capturing then
    capturing = false
    captureCallback = nil
    SetNuiFocus(false, false)
  end
end)
