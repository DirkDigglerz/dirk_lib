local DevTools = {}
DevTool = {}
DevTool.__index = DevTool

DevTool.register = function(name, data)
  local self = setmetatable(data, DevTool)
  self.name = name
  assert(data.label, 'DevTool must have a label')
  assert(data.description, 'DevTool must have a description')
  assert(data.icon, 'DevTool must have an icon')
  assert(data.action, 'DevTool must have an action')
  if data.command then 
    RegisterCommand(name, data.action)
  end
  DevTools[name] = self
  return self
end 

DevTool.get = function(name)
  return DevTools[name]
end

DevTool.getAll = function()
  return DevTools
end

DevTool.delete = function(name)
  DevTools[name] = nil
end