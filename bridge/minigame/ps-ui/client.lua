-- ps-ui minigame bridge
-- Bridges ps-ui circle, scrambler, maze, and VAR hack minigames

local function circleMinigame(difficulty, duration, inputs)
  local circles = math.min(inputs or 1, 5)
  local ms = math.max(20 - (difficulty * 3), 5) -- higher difficulty = smaller time window
  local success = exports['ps-ui']:Circle(circles, ms)
  return success == true
end

local function scramblerMinigame(difficulty, duration, inputs)
  local type = difficulty <= 2 and 'numeric' or (difficulty <= 4 and 'alphabetic' or 'alphanumeric')
  local groups = math.min(difficulty, 4)
  local time = math.max(30 - (difficulty * 4), 10)
  local success = exports['ps-ui']:Scrambler(type, time, 0, groups)
  return success == true
end

local function varHack(difficulty, duration, inputs)
  local blocks = math.min(difficulty + 1, 6)
  local time = math.max(15 - (difficulty * 2), 5)
  local success = exports['ps-ui']:VarHack(blocks, time)
  return success == true
end

return {
  skillcheck = circleMinigame,
  lockpick = circleMinigame,
  hack = varHack,
  thermite = circleMinigame,
  drill = circleMinigame,
  scrambler = scramblerMinigame,
}
