-- Event bridge: modules/gizmo runs in consumer context and cannot SendNuiMessage
-- to dirk_lib's NUI frame. These handlers receive events from the module and
-- forward them as NUI messages in dirk_lib's runtime.

local gizmoControlsResource = nil

AddEventHandler('dirk_lib:showGizmoControls', function(keys)
  gizmoControlsResource = GetInvokingResource() or GetCurrentResourceName()
  SendNuiMessage(json.encode({ action = 'SHOW_GIZMO_CONTROLS', data = keys }))
end)

AddEventHandler('dirk_lib:hideGizmoControls', function()
  gizmoControlsResource = nil
  SendNuiMessage(json.encode({ action = 'HIDE_GIZMO_CONTROLS' }))
end)

AddEventHandler('onResourceStop', function(resource)
  if gizmoControlsResource and resource == gizmoControlsResource then
    gizmoControlsResource = nil
    SendNuiMessage(json.encode({ action = 'HIDE_GIZMO_CONTROLS' }))
  end
end)
