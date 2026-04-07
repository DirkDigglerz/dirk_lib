-- ox_lib skillcheck bridge
-- Maps unified difficulty (1-5) to ox_lib difficulty strings

local DIFFICULTY_MAP = {
  [1] = { 'easy' },
  [2] = { 'easy', 'easy' },
  [3] = { 'easy', 'medium' },
  [4] = { 'medium', 'medium', 'easy' },
  [5] = { 'medium', 'hard', 'medium' },
}

local function runSkillcheck(difficulty, duration, inputs, options)
  local diffs = DIFFICULTY_MAP[difficulty] or DIFFICULTY_MAP[3]

  -- Repeat patterns based on inputs count
  local pattern = {}
  for i = 1, (inputs or 1) do
    for _, d in ipairs(diffs) do
      pattern[#pattern + 1] = d
    end
  end

  local success = exports.ox_lib:skillCheck(pattern, options.keys or { 'w', 'a', 's', 'd' })
  return success == true
end

return {
  skillcheck = runSkillcheck,
  lockpick = function(difficulty, duration, inputs, options)
    return runSkillcheck(math.min(difficulty + 1, 5), duration, inputs or 2, options)
  end,
  hack = function(difficulty, duration, inputs, options)
    return runSkillcheck(difficulty, duration, inputs or 3, options)
  end,
  thermite = function(difficulty, duration, inputs, options)
    return runSkillcheck(math.min(difficulty + 1, 5), duration, inputs or 1, options)
  end,
  drill = function(difficulty, duration, inputs, options)
    return runSkillcheck(difficulty, duration, inputs or 1, options)
  end,
  scrambler = function(difficulty, duration, inputs, options)
    return runSkillcheck(difficulty, duration, inputs or 4, options)
  end,
}
