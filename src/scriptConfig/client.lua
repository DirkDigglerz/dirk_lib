-- --------------------------------------------------
-- GLOBAL /dirk_config CLIENT HANDLER
-- --------------------------------------------------
-- Receives the chooser list from the server, opens dirk_lib's own NUI, and
-- forwards the selected resource back for dispatch.

local chooserOpen = false

local function closeChooser()
  if not chooserOpen then return end
  chooserOpen = false
  SendNuiMessage(json.encode({ action = 'CLOSE_SCRIPT_CONFIG_CHOOSER' }))
  SetNuiFocus(false, false)
end

RegisterNetEvent('dirk_lib:openScriptConfigChooser', function(list)
  if chooserOpen then return end
  chooserOpen = true

  SetNuiFocus(true, true)
  SendNuiMessage(json.encode({
    action = 'OPEN_SCRIPT_CONFIG_CHOOSER',
    data = { scripts = list or {} },
  }))
end)

-- Polled by per-script CONFIG_PANEL_BACK handlers so they can drop their
-- own NUI focus claim only AFTER we've taken focus on this resource.
-- TriggerEvent doesn't cross resources on the client, so an export poll
-- is the simplest race-free signal.
exports('isScriptConfigChooserOpen', function()
  return chooserOpen
end)

RegisterNuiCallback('SCRIPT_CONFIG_CHOOSER_PICK', function(data, cb)
  chooserOpen = false
  -- Don't release NUI focus: the picked resource will take over and re-grab
  -- focus. Releasing here causes a brief frame where the player's character
  -- can move/look around between the chooser closing and the consumer UI
  -- mounting.

  local resource = data and data.resource
  if type(resource) == 'string' and resource ~= '' then
    TriggerServerEvent('dirk_lib:scriptConfigChooserPick', resource)
  end

  cb({ success = true })
end)

RegisterNuiCallback('SCRIPT_CONFIG_CHOOSER_CLOSE', function(_, cb)
  closeChooser()
  cb({ success = true })
end)

-- Called by a consumer's scriptConfig module once it has finished grabbing
-- NUI focus. Lets the chooser release its lingering focus claim without
-- creating the focus gap that prompted us to keep it held during pick.
exports('releaseScriptConfigChooserFocus', function()
  if chooserOpen then return end
  SetNuiFocus(false, false)
end)

-- --------------------------------------------------
-- SCRIPT STUDIO
-- --------------------------------------------------
-- The hub that replaces the chooser. The server hands over the schemas this
-- player may edit; the VALUES are pulled per resource from that resource's own
-- permission-gated `getFullScriptConfig`, so server-only values keep travelling
-- through the one path that checks who is asking.

local studioOpen = false

local function closeStudio()
  if not studioOpen then return end
  studioOpen = false
  SendNuiMessage(json.encode({ action = 'CLOSE_SCRIPT_STUDIO' }))
  SetNuiFocus(false, false)
end

RegisterNetEvent('dirk_lib:openScriptStudio', function(focus)
  if studioOpen then return end
  studioOpen = true

  local scripts = lib.callback.await('dirk_lib:getScriptStudio', false)
  if type(scripts) ~= 'table' or #scripts == 0 then
    studioOpen = false
    lib.notify({ type = 'error', description = 'No script settings available.' })
    return
  end

  -- Values one resource at a time. Sequential on purpose: a callback per
  -- resource all at once would land as a burst of net events, and the panel
  -- cannot render before the first one arrives anyway.
  for i = 1, #scripts do
    local entry = scripts[i]
    local ok, values = pcall(function()
      return lib.callback.await(('%s:getFullScriptConfig'):format(entry.resource), false)
    end)
    entry.values = (ok and type(values) == 'table') and values or {}
  end

  SetNuiFocus(true, true)
  SendNuiMessage(json.encode({
    action = 'OPEN_SCRIPT_STUDIO',
    data = { scripts = scripts, focus = focus },
  }))
end)

RegisterNUICallback('CLOSE_SCRIPT_STUDIO', function(_, cb)
  closeStudio()
  cb({})
end)

-- Losing the resource while the panel is open would leave NUI focus stuck.
AddEventHandler('onResourceStop', function(resource)
  if resource == GetCurrentResourceName() then closeStudio() end
end)

-- Proxy the per-resource, permission-gated callbacks the panel needs. The hub
-- renders every script, but each script still answers for its own data — so
-- these forward by resource name rather than dirk_lib answering on their behalf.
RegisterNUICallback('GET_SCRIPT_CONFIG_HISTORY', function(payload, cb)
  local resource = type(payload) == 'table' and payload.resource
  if type(resource) ~= 'string' or resource == '' then return cb({ entries = {}, total = 0 }) end

  local ok, result = pcall(function()
    return lib.callback.await(('%s:getScriptConfigHistory'):format(resource), false, payload)
  end)
  cb((ok and type(result) == 'table') and result or { entries = {}, total = 0 })
end)

