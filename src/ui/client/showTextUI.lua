-- export type PositionProps = 'top-right' | 'right-center' | 'bottom-right' | 'top-left' | 'left-center' | 'bottom-left' | 'bottom-center' | 'top-center' | 
-- {  
--   top?: string | number
--   right?: string | number
--   bottom?: string | number
--   left?: string | number
--   transition?: 'slide-right' | 'slide-left' | 'slide-up' | 'slide-down' | 'fade'
--   transform?: string
-- }

-- type TextUIOptions = {
--   position?: PositionProps
--   icon?: string
--   iconColor?: string
--   iconAnimation?: string
--   style?: React.CSSProperties
--   alignIcon?: 'top' | 'center' | 'bottom'
-- }

local cachedBridge, cachedProvider
local function getBridge()
  local provider = lib.settings.showTextUI
  if not provider or provider == 'dirk_lib' then return nil end
  if cachedProvider ~= provider then
    cachedProvider = provider
    cachedBridge = lib.loadBridge('interface', provider, 'client')
  end
  return cachedBridge
end

local invoking_resource = nil
AddEventHandler('onResourceStop', function(resource)
  if resource == invoking_resource then
    lib.hideTextUI()
  end
end)

local isOpen = false
lib.showTextUI = function(text, options)
  assert(text and type(text) == 'string', 'text must be a string')
  assert(options == nil or type(options) == 'table', 'options must be a table or nil')
  invoking_resource = GetInvokingResource()
  if not options then options = {
    position = lib.settings.showTextPosition,
  } end
  if not options.position then options.position = lib.settings.showTextPosition end

  local b = getBridge()
  if b and b.showTextUI then
    isOpen = true
    return b.showTextUI(text, options)
  end

  isOpen = true
  options.theme = lib.uiTheme(invoking_resource)
  SendNuiMessage(json.encode({
    action = 'SHOW_TEXT_UI',
    data = {
      text = text,
      options = options
    }
  }))
end

lib.updateTextUI = function(text)
  assert(text and type(text) == 'string', 'text must be a string')
  if not isOpen then return end

  local b = getBridge()
  if b and b.showTextUI then
    -- ox_lib has no separate update; re-show with same text refreshes content
    return b.showTextUI(text)
  end

  SendNuiMessage(json.encode({
    action = 'UPDATE_TEXT_UI',
    data = text,
  }))
end

lib.hideTextUI = function()
  isOpen = false

  local b = getBridge()
  if b and b.hideTextUI then return b.hideTextUI() end

  SendNuiMessage(json.encode({
    action = 'HIDE_TEXT_UI'
  }))
end

lib.isTextUIOpen = function()
  local b = getBridge()
  if b and b.isTextUIOpen then return b.isTextUIOpen() end
  return isOpen
end