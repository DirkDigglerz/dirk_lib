local cachedBridge, cachedProvider
local function getBridge()
  local provider = lib.settings.inputDialog or lib.settings.dialog
  if not provider or provider == 'dirk_lib' then return nil end
  if cachedProvider ~= provider then
    cachedProvider = provider
    cachedBridge = lib.loadBridge('interface', provider, 'client')
  end
  return cachedBridge
end

lib.inputDialog = function(title, inputs, options)
  local b = getBridge()
  if b and b.inputDialog then return b.inputDialog(title, inputs, options) end

  if input then return end
  input = promise.new()
  options = options or {}

  SetNuiFocus(true, true)
  SendNuiMessage(json.encode({
    action = 'OPEN_INPUT_DIALOG',
    data   = {
      info    = {
        title = title,
        description = options.description,     
        icon  = options.icon or 'keyboard',
        allowCancel = options.allowCancel ~= nil and options.allowCancel or true,
        prevContext = options.prevContext,
        prevDialog  = options.prevDialog
      },
      inputs  = inputs,
    },
  }))

  return Citizen.Await(input)
end

lib.closeInputDialog = function()
  local b = getBridge()
  if b and b.closeInputDialog then return b.closeInputDialog() end

  if not input then return end

  SendNuiMessage(json.encode({
    action = 'CLOSE_INPUT_DIALOG',
  }))
  SetNuiFocus(false, false)

  input:resolve(nil)
  input = nil
end

RegisterNuiCallback('INPUT_GO_BACK', function(data, cb)
  lib.closeInputDialog()
  if data?.prevContext then 
    cb({})
    return lib.openContext(data.prevContext)
  elseif data?.prevDialog then 
    cb({})
    return lib.openDialog(data.prevDialog)
  end 
end)

RegisterNuiCallback('INPUT_DIALOG_SUBMIT', function(data, cb)
  if data then 
    data.prevContext = nil
    data.prevDialog = nil
  end
  input:resolve(data)
  input = nil
  SetNuiFocus(false, false)
  cb({})
end)

