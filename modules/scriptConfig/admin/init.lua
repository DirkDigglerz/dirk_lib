-- Bootstrap for the admin-tool subsystem.
--
-- Required by modules/scriptConfig/client.lua at startup. This file runs
-- inside the consumer's resource VM (because @dirk_lib/init.lua is loaded
-- via shared_script). Result: every consumer with `dirk_lib 'scriptConfig'`
-- in their fxmanifest gets the admin tools registered automatically — no
-- per-consumer Lua, no fxmanifest tweaks, no manual hooks.
--
-- Tools live under tools/* and each one:
--   • Registers its own NUI callbacks (ADMIN_TOOL_BEGIN / ADMIN_TOOL_INVOKE
--     handlers route to the correct tool by `data.id`)
--   • Adds its function(s) to the `lib.adminTool.*` namespace
--   • Self-guards on the shared "admin panel currently open" flag below
--
-- The flag below is the only thing shared across tools — flipped true when
-- the scriptConfig admin UI opens (server already validated perms at that
-- point) and false when it closes. Every tool's NUI handler checks the
-- flag before doing anything, so a player who somehow keeps an NUI iframe
-- alive after losing admin perms can't trigger tools.
-- `lib` has a __index lazy loader that returns a loader-function for any
-- key not already present (so `lib.foo` tries to load `modules/foo`). That
-- means `lib.adminTool = lib.adminTool or {}` would see the loader function
-- (truthy) and never assign the empty table. rawset bypasses the metatable.
if type(rawget(lib, 'adminTool')) ~= 'table' then
  rawset(lib, 'adminTool', {})
end

local adminEditing = false

function _G.__dirkLibIsAdminEditing()
  return adminEditing
end

AddEventHandler('dirk_lib:scriptConfigOpened', function()
  adminEditing = true
end)

AddEventHandler('dirk_lib:scriptConfigClosed', function()
  adminEditing = false
end)

-- ── Central NUI callback dispatchers ──────────────────────────────────────
-- Tools register their handlers via `adminToolHandlers[id]` rather than
-- their own RegisterNUICallback. Keeps the NUI surface tight (two endpoints
-- total) and means tool authors don't need to think about NUI plumbing.
_G.__dirkLibAdminToolHandlers = _G.__dirkLibAdminToolHandlers or {
  begin  = {}, -- id -> function() — long-running flows like capturePosition
  invoke = {}, -- id -> function(payload) — fire-and-forget like gotoCoord
  query  = {}, -- id -> function(payload) -> result — request/response like validateModels
}

RegisterNUICallback('ADMIN_TOOL_BEGIN', function(data, cb)
  cb({})
  if not adminEditing then return end
  if type(data) ~= 'table' or type(data.id) ~= 'string' then return end
  local handler = _G.__dirkLibAdminToolHandlers.begin[data.id]
  if type(handler) == 'function' then handler(data) end
end)

RegisterNUICallback('ADMIN_TOOL_INVOKE', function(data, cb)
  cb({})
  if not adminEditing then return end
  if type(data) ~= 'table' or type(data.id) ~= 'string' then return end
  local handler = _G.__dirkLibAdminToolHandlers.invoke[data.id]
  if type(handler) == 'function' then handler(data) end
end)

-- Query dispatcher: synchronous request/response. Handler returns a value
-- which is sent back via cb so fetchNui resolves with it. Used by tools
-- where the React side needs an answer (e.g. validateModels).
RegisterNUICallback('ADMIN_TOOL_QUERY', function(data, cb)
  if not adminEditing then return cb(nil) end
  if type(data) ~= 'table' or type(data.id) ~= 'string' then return cb(nil) end
  local handler = _G.__dirkLibAdminToolHandlers.query[data.id]
  if type(handler) ~= 'function' then return cb(nil) end
  local ok, result = pcall(handler, data)
  if not ok then
    lib.print.warn(('adminTool query [%s] errored: %s'):format(data.id, tostring(result)))
    return cb(nil)
  end
  cb(result)
end)

-- Load every tool. Adding a new one = drop a new file in tools/ and add
-- one require line below — no central registry to wire up.
require '@dirk_lib/modules/scriptConfig/admin/tools/position'
require '@dirk_lib/modules/scriptConfig/admin/tools/models'
require '@dirk_lib/modules/scriptConfig/admin/tools/players'

-- ── pickDoor forwarder ────────────────────────────────────────────────
-- The picker logic lives in dirk_lib's own VM (src/devtools/client/
-- pickDoorTool.lua) so it draws sphere/outline natives from a clean
-- render context. This consumer-side forwarder just relays:
--
--   ADMIN_TOOL_BEGIN {id='pickDoor'} → dirk_lib:adminTool:pickDoor:begin
--                                         (handled in dirk_lib's VM)
--   ↓ picker runs ↓
--   dirk_lib:adminTool:pickDoor:result → SendNuiMessage to this
--                                         consumer's NUI so the React
--                                         promise resolver settles
--
-- Two thin lines per direction, zero picker logic in the consumer.

_G.__dirkLibAdminToolHandlers.begin['pickDoor'] = function()
  -- SetNuiFocus is per-resource. The admin clicked Pick Door from THIS
  -- consumer's NUI, so this consumer owns the focus — dirk_lib calling
  -- SetNuiFocus(false, false) from its own VM wouldn't release it.
  -- Release here, regrab on result below.
  SetNuiFocus(false, false)
  TriggerScreenblurFadeOut(0)
  TriggerEvent('dirk_lib:adminTool:pickDoor:begin', cache.resource)
end

AddEventHandler('dirk_lib:adminTool:pickDoor:result', function(originResource, payload)
  -- Only relay results meant for THIS consumer — every consumer's init
  -- runs in its own VM and listens to the same global event, so we
  -- filter on the origin tag the tool fired with.
  if originResource ~= cache.resource then return end
  SetNuiFocus(true, true)
  TriggerScreenblurFadeIn(0)
  SendNuiMessage(json.encode({
    action = payload and 'pickDoor_RESULT' or 'pickDoor_CANCELLED',
    data   = payload,
  }))
end)
