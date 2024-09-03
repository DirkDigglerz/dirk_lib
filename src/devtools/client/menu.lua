local openDevtools = function()
  local allTools = DevTool.getAll()
  local options  = {}
  for name, tool in pairs(allTools) do
    table.insert(options, {
      title = tool.label,
      icon = tool.icon,
      description = tool.description,
      onSelect = function()
        tool.action()
      end
    })
  end
  lib.registerContext('devTools', {
    title = 'Dev Tools',
    icon = 'cog',
    options = options,
  })

  Wait(0)

  lib.openContext('devTools')
end

RegisterCommand('devtools', openDevtools)