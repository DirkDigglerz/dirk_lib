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

RegisterNuiCallback('SCRIPT_CONFIG_CHOOSER_PICK', function(data, cb)
  chooserOpen = false
  SetNuiFocus(false, false)

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
