local colorFormatting = {
  red = '^1',
  green = '^2',
  yellow = '^3',
  blue = '^4',
  lightBlue = '^5',
  purple = '^6',
  white = '^7',
  orange = '^8',
  gray = '^9',
  black = '^0',
  default = '^7'
}


local print_types = {
  info = {
    prefixText = 'INFO',
    color = 'lightBlue',
    condition = function() return true end
  },
  warn = {
    prefixText = 'WARN',
    color = 'yellow',
    condition = function() return true end
  },
  error = {
    prefixText = 'ERROR',
    color = 'red',
    condition = function() return true end
  },
  -- Gate debug prints on the calling resource's own debug flag when it has
  -- registered a scriptConfig (look for `basic.debug` first, then top-level
  -- `debug`). Falls back to dirk_lib's own `lib.settings.debug` for resources
  -- that haven't registered a scriptConfig (incl. dirk_lib itself before
  -- onSettings hydrates).
  debug = {
    prefixText = 'DEBUG',
    color = 'green',
    condition = function()
      if scriptConfig then
        if type(scriptConfig.basic) == 'table' and scriptConfig.basic.debug ~= nil then
          return scriptConfig.basic.debug == true
        end
        if scriptConfig.debug ~= nil then
          return scriptConfig.debug == true
        end
      end
      return lib.settings and lib.settings.debug
    end
  },
}

lib.print = {

  addType = function(_type, prefixText, color, condition)
    local prefix = ('%s[%s] %s'):format(colorFormatting[color], prefixText, colorFormatting.default)
    lib.print[_type] = function(...)
      if condition and not condition() then return end
      print(prefix, ...)
    end
  end,
}

setmetatable(lib.print, {
  __call = function(_, ...)
    lib.print.info(...)
  end
})

for k, v in pairs(print_types) do 
  lib.print.addType(k, v.prefixText, v.color, v.condition)
end



return lib.print