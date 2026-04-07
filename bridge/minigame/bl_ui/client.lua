-- bl_ui minigame bridge
-- Bridges bl_ui skillcheck/minigame resources

local DIFFICULTY_MAP = {
  [1] = 'easy',
  [2] = 'easy',
  [3] = 'medium',
  [4] = 'hard',
  [5] = 'hard',
}

local function runSkillcheck(difficulty, duration, inputs, options)
  local diff = DIFFICULTY_MAP[difficulty] or 'medium'
  local success = exports['bl_ui']:skillCheck(diff, inputs or 1)
  return success == true
end

return {
  skillcheck = runSkillcheck,
  lockpick = runSkillcheck,
  hack = runSkillcheck,
  thermite = runSkillcheck,
  drill = runSkillcheck,
  scrambler = runSkillcheck,
}
