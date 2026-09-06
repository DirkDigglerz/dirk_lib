local settings = lib.settings

local cachedBridge, cachedProvider
local function getBridge()
  local provider = lib.settings.contextMenu
  if not provider or provider == 'dirk_lib' then return nil end
  if cachedProvider ~= provider then
    cachedProvider = provider
    cachedBridge = lib.loadBridge('interface', provider, 'client')
  end
  return cachedBridge
end

local ContextMenus   = {}
local ContextMenu    = {}
ContextMenu.__index  = ContextMenu

function ContextMenu:getNuiData()
  -- Ensure no functions are passed to NUI
  local data = {}
  for k,v in pairs(self) do
    if type(v) ~= 'function' then
      data[k] = v
    end
  end
  return data
end 

function ContextMenu:close(fromMenu)
  self.isOpen = false
  if self.onExit then self.onExit() end
  SetNuiFocus(false, false)
  SendNuiMessage(json.encode({
    action = 'CLOSE_CONTEXT',
  }))
end

function ContextMenu:open(fromMenu)
  local currentContext = ContextMenu.getOpen()
  if currentContext and not fromMenu then 
    currentContext:close()
  end

  Wait(0)

  self.isOpen = true
  self:sanitizeOptions()
  
  SetNuiFocus(true, true)

  local payload = self:getNuiData()
  -- Resolved at SEND time, not at register time, so a theme changed while a
  -- menu is registered is picked up the next time it opens.
  payload.theme = lib.uiTheme(self.resource)

  SendNuiMessage(json.encode({
    action = 'OPEN_CONTEXT',
    data   = payload
  }, { sort_keys = true }))
end

function ContextMenu:sanitizeOptions()
  local is_func = type(self.options) == 'function' or rawget(self.options, '__cfx_functionReference')
  self.options = is_func and self.options() or self.options
  for i, item in ipairs(self.options) do
    item.id = string.format('%s_%s', self.id, i)
    item.onSelect = item.onSelect and msgpack.unpack(msgpack.pack(item.onSelect)) or nil  
  end
  return true 
end

function ContextMenu:__init()
  self.clickSounds = self.clickSounds or settings.contextClickSounds
  self.hoverSounds = self.hoverSounds or settings.contextHoverSounds
  self.canClose    = self.canClose ~= nil and self.canClose or true
  if not self.id then return false, 'No id provided' end
  if not self.title then return false, 'No title provided' end
  if not self.options then return false, 'No options provided' end
  self:sanitizeOptions()
  return true
end

ContextMenu.getOpen = function()
  for k,v in pairs(ContextMenus) do 
    if v.isOpen then return v end
  end
  return false
end 

ContextMenu.closeAll = function()
  for k,v in pairs(ContextMenus) do 
    if v.isOpen then v:close() end
  end
end

ContextMenu.register = function(id, data)
  if type(id) == 'table' then 
    data = id
    data.id = data.id
    id = data.id
  end

  local self = setmetatable(data, ContextMenu)
  self.id = id
  local init, reason = self:__init()
  if not init then 
    lib.print.info(('Failed to register context menu %s: %s'):format(id, reason)) 
    return false, reason 
  end 

  ContextMenus[id] = self
  return true
end

function ContextMenu:getOptionById(id)
  for k,v in pairs(self.options) do 
    if v.id == id then return v end
  end
  return false
end

function ContextMenu:optionClicked(id)
  if not self.isOpen then return end
  local option = self:getOptionById(id)
  if not option then return end

  if (option.willClose or option.willClose == nil and not option.menu) or option.dialog then 
    self:close()
  end

  if option.onSelect then option.onSelect() end

  if option.clientEvent then TriggerEvent(option.clientEvent, option.args) end

  if option.serverEvent then TriggerServerEvent(option.serverEvent, option.args) end

  if option.menu then 
    local menu = ContextMenus[option.menu]
    if menu then 
      self.isOpen = false
      if self.onExit then self.onExit() end
      menu:open(true)
    end
  end  

  if option.dialog then 
    self:close()
    lib.openDialog(option.dialog)
  end
end 

RegisterNuiCallback('CONTEXT_CLICKED', function(id,cb)
  cb('ok')
  local currentOpen = ContextMenu.getOpen()
  if currentOpen then 
    currentOpen:optionClicked(id)
  end
end)



lib.registerContext = function(id, data)
  local b = getBridge()
  if b and b.registerContext then
    if type(id) == 'table' then data = id; id = data.id end
    data = data or {}
    data.id = id
    return b.registerContext(data)
  end

  -- Whose menu this is, captured HERE. `GetInvokingResource` only answers for
  -- the frame that crossed the export boundary, so it has to be read at the
  -- entry point rather than further down.
  if type(id) == 'table' then
    id.resource = GetInvokingResource() or GetCurrentResourceName()
  else
    data = data or {}
    data.resource = GetInvokingResource() or GetCurrentResourceName()
  end

  return ContextMenu.register(id, data)
end

lib.openContext = function(id, fromMenu)
  local b = getBridge()
  if b and b.showContext then return b.showContext(id) end

  local context = ContextMenus[id]
  if not context then error('No such context menu found') end
  return context:open(fromMenu)
end

lib.getOpenContextMenu = function()
  local b = getBridge()
  if b and b.getOpenContextMenu then return b.getOpenContextMenu() end
  return ContextMenu.getOpen()
end
-- OX COMPATIBILITY
lib.showContext = lib.openContext

RegisterNuiCallback('OPEN_CONTEXT', function(data,cb)
  if data.back then 
    local menu = ContextMenu.getOpen()
    if menu then 
      if menu.onBack then menu.onBack() end
    end
  end 

  local menu = ContextMenus[data.id]
  if not menu then return end
  menu:open(true)
end)

lib.closeContext = function(onExit)
  local b = getBridge()
  if b and b.hideContext then return b.hideContext(onExit) end
  return ContextMenu.closeAll()
end
lib.hideContext = lib.closeContext

RegisterNuiCallback('CLOSE_CONTEXT', lib.closeContext)

RegisterNuiCallback('CONTEXT_BACK', function(data,cb)
  local menuOpen = ContextMenu.getOpen()
  if menuOpen then 
    if menuOpen.menu then 
      menuOpen.isOpen = false
      local menu = ContextMenus[menuOpen.menu]
      if menu then 
        menu:open(true)
      end
    end
    
    if menuOpen.dialog then 
      menuOpen:close()
      lib.openDialog(menuOpen.dialog)
    end
    
    if menuOpen.onExit then menuOpen.onExit() end
    if menuOpen.onBack then menuOpen.onBack() end
  end
end)

