-- dirk_lib internal minigame bridge
-- Uses dirk_lib's own progress bar as a basic "hold to complete" minigame fallback

local function holdProgress(difficulty, duration, inputs, options)
  local label = options and options.label or 'Working...'
  local time = (duration or 10) * 1000

  local success = lib.startProgress({
    label = label,
    duration = time,
    position = 'bottom-center',
    disable = {
      move = difficulty >= 3,
      combat = true,
    },
    anim = options and options.anim or nil,
  })

  return success == true
end

return {
  skillcheck = holdProgress,
  lockpick = holdProgress,
  hack = holdProgress,
  thermite = holdProgress,
  drill = holdProgress,
  scrambler = holdProgress,
}
