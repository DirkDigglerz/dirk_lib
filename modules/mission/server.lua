---@class MissionStep
---@field id string
---@field label string
---@field onStart? fun(groupId: string, step: MissionStep, args: table)
---@field onComplete? fun(groupId: string, step: MissionStep, args: table)
---@field onFail? fun(groupId: string, step: MissionStep, args: table)
---@field timeout? number seconds, 0 = no timeout

---@class MissionDef
---@field id string
---@field label string
---@field steps MissionStep[]
---@field onComplete? fun(groupId: string, mission: MissionDef)
---@field onFail? fun(groupId: string, mission: MissionDef, reason: string)
---@field onPlayerReconnect? fun(src: number, groupId: string, stepId: string)

local missions = {}     -- registered mission definitions
local instances = {}     -- active mission instances keyed by groupId

local mission = {}

--- Register a mission definition
---@param data MissionDef
function mission.register(data)
  if not data.id then
    return lib.print.error('mission.register: missing id')
  end
  if not data.steps or #data.steps == 0 then
    return lib.print.error('mission.register: mission must have at least one step')
  end
  missions[data.id] = data
  lib.print.debug(('Registered mission: %s (%d steps)'):format(data.id, #data.steps))
end

--- Start a mission for a group
---@param missionId string
---@param groupId string
---@param args? table extra data passed to steps
---@return boolean success
function mission.start(missionId, groupId, args)
  local def = missions[missionId]
  if not def then
    lib.print.error(('mission.start: unknown mission "%s"'):format(missionId))
    return false
  end

  if instances[groupId] then
    lib.print.warn(('mission.start: group "%s" already has an active mission'):format(groupId))
    return false
  end

  local instance = {
    missionId = missionId,
    groupId = groupId,
    currentStep = 1,
    state = 'active', -- active | completed | failed
    startedAt = os.time(),
    args = args or {},
    stepStates = {},
  }

  -- Initialize step states
  for i, step in ipairs(def.steps) do
    instance.stepStates[step.id] = 'pending' -- pending | active | completed | failed
  end

  instances[groupId] = instance

  -- Start first step
  mission.advanceStep(groupId)

  return true
end

--- Advance to the current step (or next step)
---@param groupId string
function mission.advanceStep(groupId)
  local instance = instances[groupId]
  if not instance or instance.state ~= 'active' then return end

  local def = missions[instance.missionId]
  if not def then return end

  local stepIdx = instance.currentStep
  if stepIdx > #def.steps then
    -- All steps complete
    mission.complete(groupId)
    return
  end

  local step = def.steps[stepIdx]
  instance.stepStates[step.id] = 'active'

  -- Notify all group members
  local group = lib.getGroup(groupId)
  if group and group.members then
    for _, member in ipairs(group.members) do
      local src = lib.player.checkOnline(member.identifier)
      if src then
        TriggerClientEvent('dirk_lib:mission:stepStart', src, {
          missionId = instance.missionId,
          groupId = groupId,
          stepId = step.id,
          stepIndex = stepIdx,
          totalSteps = #def.steps,
          label = step.label,
          timeout = step.timeout or 0,
          args = instance.args,
        })
      end
    end
  end

  -- Call server-side onStart
  if step.onStart then
    step.onStart(groupId, step, instance.args)
  end

  -- Start timeout if set
  if step.timeout and step.timeout > 0 then
    SetTimeout(step.timeout * 1000, function()
      local inst = instances[groupId]
      if inst and inst.state == 'active' and inst.currentStep == stepIdx then
        if inst.stepStates[step.id] == 'active' then
          mission.failStep(groupId, step.id, 'timeout')
        end
      end
    end)
  end
end

--- Complete the current step and move to next
---@param groupId string
---@param stepId string
function mission.completeStep(groupId, stepId)
  local instance = instances[groupId]
  if not instance or instance.state ~= 'active' then return end

  local def = missions[instance.missionId]
  if not def then return end

  local step = def.steps[instance.currentStep]
  if not step or step.id ~= stepId then return end

  instance.stepStates[stepId] = 'completed'

  if step.onComplete then
    step.onComplete(groupId, step, instance.args)
  end

  -- Notify clients
  local group = lib.getGroup(groupId)
  if group and group.members then
    for _, member in ipairs(group.members) do
      local src = lib.player.checkOnline(member.identifier)
      if src then
        TriggerClientEvent('dirk_lib:mission:stepComplete', src, {
          missionId = instance.missionId,
          groupId = groupId,
          stepId = stepId,
        })
      end
    end
  end

  -- Advance
  instance.currentStep = instance.currentStep + 1
  mission.advanceStep(groupId)
end

--- Fail the current step
---@param groupId string
---@param stepId string
---@param reason? string
function mission.failStep(groupId, stepId, reason)
  local instance = instances[groupId]
  if not instance or instance.state ~= 'active' then return end

  local def = missions[instance.missionId]
  if not def then return end

  instance.stepStates[stepId] = 'failed'

  local step = def.steps[instance.currentStep]
  if step and step.onFail then
    step.onFail(groupId, step, instance.args)
  end

  mission.fail(groupId, reason or 'step_failed')
end

--- Complete the entire mission
---@param groupId string
function mission.complete(groupId)
  local instance = instances[groupId]
  if not instance then return end

  local def = missions[instance.missionId]
  instance.state = 'completed'

  -- Notify clients
  local group = lib.getGroup(groupId)
  if group and group.members then
    for _, member in ipairs(group.members) do
      local src = lib.player.checkOnline(member.identifier)
      if src then
        TriggerClientEvent('dirk_lib:mission:complete', src, {
          missionId = instance.missionId,
          groupId = groupId,
        })
      end
    end
  end

  if def and def.onComplete then
    def.onComplete(groupId, def)
  end

  instances[groupId] = nil
end

--- Fail the entire mission
---@param groupId string
---@param reason? string
function mission.fail(groupId, reason)
  local instance = instances[groupId]
  if not instance then return end

  local def = missions[instance.missionId]
  instance.state = 'failed'

  -- Notify clients
  local group = lib.getGroup(groupId)
  if group and group.members then
    for _, member in ipairs(group.members) do
      local src = lib.player.checkOnline(member.identifier)
      if src then
        TriggerClientEvent('dirk_lib:mission:fail', src, {
          missionId = instance.missionId,
          groupId = groupId,
          reason = reason or 'unknown',
        })
      end
    end
  end

  if def and def.onFail then
    def.onFail(groupId, def, reason or 'unknown')
  end

  instances[groupId] = nil
end

--- Get active mission instance for a group
---@param groupId string
---@return table|nil
function mission.getInstance(groupId)
  return instances[groupId]
end

--- Get the current step for a group's mission
---@param groupId string
---@return MissionStep|nil, number|nil
function mission.getCurrentStep(groupId)
  local instance = instances[groupId]
  if not instance then return nil, nil end

  local def = missions[instance.missionId]
  if not def then return nil, nil end

  local step = def.steps[instance.currentStep]
  return step, instance.currentStep
end

--- Handle player reconnect — sync them to current mission state
---@param src number
---@param identifier string
function mission.handleReconnect(src, identifier)
  for groupId, instance in pairs(instances) do
    if instance.state == 'active' then
      local group = lib.getGroup(groupId)
      if group and group.members then
        for _, member in ipairs(group.members) do
          if member.identifier == identifier then
            local def = missions[instance.missionId]
            local step = def and def.steps[instance.currentStep]
            if step then
              TriggerClientEvent('dirk_lib:mission:stepStart', src, {
                missionId = instance.missionId,
                groupId = groupId,
                stepId = step.id,
                stepIndex = instance.currentStep,
                totalSteps = #def.steps,
                label = step.label,
                timeout = 0, -- don't restart timeout on reconnect
                args = instance.args,
                reconnect = true,
              })
            end
            if def and def.onPlayerReconnect then
              def.onPlayerReconnect(src, groupId, step and step.id)
            end
            return
          end
        end
      end
    end
  end
end

-- Callback so clients can complete/fail steps
lib.callback.register('dirk_lib:mission:completeStep', function(source, groupId, stepId)
  mission.completeStep(groupId, stepId)
  return true
end)

lib.callback.register('dirk_lib:mission:failStep', function(source, groupId, stepId, reason)
  mission.failStep(groupId, stepId, reason)
  return true
end)

return mission
