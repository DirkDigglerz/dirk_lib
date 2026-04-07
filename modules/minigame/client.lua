local settings = lib.settings
local bridge = lib.loadBridge('minigame', settings.minigame or 'ox_lib', 'client')

--- Play a minigame and return success/failure.
--- Unified API across all minigame resources.
---@param gameType string 'skillcheck' | 'lockpick' | 'hack' | 'thermite' | 'drill' | 'scrambler'
---@param options? table { difficulty?: number (1-5), duration?: number, inputs?: number }
---@return boolean success
local function minigame(gameType, options)
  options = options or {}
  local difficulty = options.difficulty or 3
  local duration = options.duration or 10
  local inputs = options.inputs or 1

  if bridge[gameType] then
    return bridge[gameType](difficulty, duration, inputs, options)
  end

  -- Fallback: try skillcheck for unknown types
  if bridge.skillcheck then
    return bridge.skillcheck(difficulty, duration, inputs, options)
  end

  lib.print.warn(('minigame: unsupported type "%s" and no fallback available'):format(gameType))
  return true -- default to success if no minigame system
end

return minigame
