local activeMission = nil  -- current mission state on this client
local stepHandlers = {}    -- registered step handlers

local mission = {}

--- Register a step handler for client-side logic
---@param stepId string
---@param handler table { onStart: function, onComplete: function, onFail: function }
function mission.registerStep(stepId, handler)
  stepHandlers[stepId] = handler
end

--- Get current mission state
---@return table|nil
function mission.getActive()
  return activeMission
end

--- Complete current step (tells server)
---@param groupId string
---@param stepId string
function mission.completeStep(groupId, stepId)
  lib.callback.await('dirk_lib:mission:completeStep', false, groupId, stepId)
end

--- Fail current step (tells server)
---@param groupId string
---@param stepId string
---@param reason? string
function mission.failStep(groupId, stepId, reason)
  lib.callback.await('dirk_lib:mission:failStep', false, groupId, stepId, reason)
end

-- Listen for step start from server
RegisterNetEvent('dirk_lib:mission:stepStart', function(data)
  activeMission = {
    missionId = data.missionId,
    groupId = data.groupId,
    stepId = data.stepId,
    stepIndex = data.stepIndex,
    totalSteps = data.totalSteps,
    label = data.label,
    reconnect = data.reconnect or false,
  }

  local handler = stepHandlers[data.stepId]
  if handler and handler.onStart then
    handler.onStart(data)
  end
end)

-- Listen for step complete
RegisterNetEvent('dirk_lib:mission:stepComplete', function(data)
  local handler = stepHandlers[data.stepId]
  if handler and handler.onComplete then
    handler.onComplete(data)
  end
end)

-- Listen for mission complete
RegisterNetEvent('dirk_lib:mission:complete', function(data)
  if activeMission then
    local handler = stepHandlers[activeMission.stepId]
    if handler and handler.onComplete then
      handler.onComplete(data)
    end
  end
  activeMission = nil
end)

-- Listen for mission fail
RegisterNetEvent('dirk_lib:mission:fail', function(data)
  if activeMission then
    local handler = stepHandlers[activeMission.stepId]
    if handler and handler.onFail then
      handler.onFail(data)
    end
  end
  activeMission = nil
end)

return mission
