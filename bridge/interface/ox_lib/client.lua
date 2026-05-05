-- --------------------------------------------------
-- ox_lib UI bridge
-- --------------------------------------------------
-- Maps dirk_lib UI primitives onto ox_lib's equivalents. Each consumer
-- (src/ui/client/*.lua) reads `lib.settings.<key>` and forwards to one of these
-- functions when the user has selected ox_lib as the provider for that primitive.
--
-- All shape translation lives here so the dirk-side renderers stay untouched.

local NOTIFY_TYPE_MAP = {
  inform  = 'inform',
  info    = 'inform',
  success = 'success',
  error   = 'error',
  warning = 'warning',
}

local function notify(data)
  local sound = data.sound
  exports.ox_lib:notify({
    id          = data.id,
    title       = data.title,
    description = data.description,
    type        = NOTIFY_TYPE_MAP[data.type] or 'inform',
    icon        = data.icon,
    iconColor   = data.iconColor,
    iconAnimation = data.iconAnimation,
    position    = data.position,
    duration    = data.duration,
    showDuration = data.showDuration,
    sound       = type(sound) == 'table' and sound.name or sound,
    style       = data.style,
  })
end

local function progressBar(data)
  return exports.ox_lib:progressBar(data)
end

local function progressCircle(data)
  return exports.ox_lib:progressCircle(data)
end

local function progressActive()
  return exports.ox_lib:progressActive()
end

local function cancelProgress()
  return exports.ox_lib:cancelProgress()
end

local function showTextUI(text, options)
  exports.ox_lib:showTextUI(text, options)
end

local function hideTextUI()
  exports.ox_lib:hideTextUI()
end

local function isTextUIOpen()
  return exports.ox_lib:isTextUIOpen()
end

-- Context — ox_lib's registerContext shape is mostly compatible. Translate
-- per-option fields that differ in name or semantics.
local function translateContextOptions(options)
  if type(options) ~= 'table' then return options end
  local out = {}
  for i = 1, #options do
    local opt = options[i]
    out[i] = {
      title       = opt.title or opt.label,
      description = opt.description,
      icon        = opt.icon,
      iconColor   = opt.iconColor,
      arrow       = opt.arrow,
      disabled    = opt.disabled,
      readOnly    = opt.readOnly,
      progress    = opt.progress,
      colorScheme = opt.colorScheme,
      image       = opt.image,
      metadata    = opt.metadata,
      menu        = opt.menu,
      onSelect    = opt.onSelect,
      event       = opt.clientEvent,
      serverEvent = opt.serverEvent,
      args        = opt.args,
    }
  end
  return out
end

local function registerContext(ctx)
  exports.ox_lib:registerContext({
    id       = ctx.id,
    title    = ctx.title,
    menu     = ctx.menu,
    onExit   = ctx.onExit,
    onBack   = ctx.onBack,
    canClose = ctx.canClose,
    options  = translateContextOptions(ctx.options),
  })
end

local function showContext(id)
  exports.ox_lib:showContext(id)
end

local function hideContext(onExit)
  exports.ox_lib:hideContext(onExit)
end

local function getOpenContextMenu()
  return exports.ox_lib:getOpenContextMenu()
end

local function alertDialog(data, timeout)
  -- ox_lib's alertDialog signature is (data) and returns 'cancel'/'confirm'
  -- We respect dirk's optional timeout by racing against a SetTimeout.
  if not timeout then return exports.ox_lib:alertDialog(data) end

  local p = promise.new()
  local resolved = false
  CreateThread(function()
    local res = exports.ox_lib:alertDialog(data)
    if not resolved then resolved = true; p:resolve(res) end
  end)
  SetTimeout(timeout, function()
    if not resolved then
      resolved = true
      pcall(function() exports.ox_lib:closeAlertDialog() end)
      p:resolve(nil)
    end
  end)
  return Citizen.Await(p)
end

local function inputDialog(heading, rows, options)
  return exports.ox_lib:inputDialog(heading, rows, options)
end

local function closeInputDialog()
  exports.ox_lib:closeInputDialog()
end

return {
  notify             = notify,
  progressBar        = progressBar,
  progressCircle     = progressCircle,
  progressActive     = progressActive,
  cancelProgress     = cancelProgress,
  showTextUI         = showTextUI,
  hideTextUI         = hideTextUI,
  isTextUIOpen       = isTextUIOpen,
  registerContext    = registerContext,
  showContext        = showContext,
  hideContext        = hideContext,
  getOpenContextMenu = getOpenContextMenu,
  alertDialog        = alertDialog,
  inputDialog        = inputDialog,
  closeInputDialog   = closeInputDialog,
}
