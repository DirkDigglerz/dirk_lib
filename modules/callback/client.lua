-- Adapted from ox_lib (https://github.com/overextended/ox_lib/blob/master/imports/callback/client.lua)
-- Licensed under LGPL-3.0: https://www.gnu.org/licenses/lgpl-3.0.html
-- and is used under the same license.

local awaitingCallbacks = {}
local callback_event = '__dirk_cb_%s'
local callback_timeout = 300000


RegisterNetEvent(callback_event:format(cache.resource), function(key, ...)
  local cb = awaitingCallbacks[key]
  awaitingCallbacks[key] = nil
  return cb and cb(...)
end)

local triggerServerCallback = function(_,event, cb, timeoutMs, ...)
  local key 
  repeat 
    key = ('%s_%s'):format(event, math.random(0, 9999999))
  until not awaitingCallbacks[key]
  TriggerServerEvent(callback_event:format(event), cache.resource, key, ...)

  local promise = not cb and promise.new()

  awaitingCallbacks[key] = function(response, ...)
    response = {response, ...}

    if promise then 
      return promise:resolve(response)
    end 

    if cb then 
      cb(table.unpack(response))
    end
  end

  -- A caller-supplied deadline RESOLVES with (nil, 'Timeout') rather than
  -- rejecting. The default five-minute timeout is a leak guard - by the time
  -- it fires the flow is long abandoned, so an error is fine. A short deadline
  -- is a flow-control decision ("this resource may be mid-restart, give it two
  -- seconds and move on"), and the caller wants an answer to branch on, not an
  -- error to trap.
  if promise and timeoutMs then
    local timer = SetTimeout(timeoutMs, function()
      awaitingCallbacks[key] = nil
      promise:resolve({ nil, 'Timeout', n = 2 })
    end)
    local response = Citizen.Await(promise)
    ClearTimeout(timer)
    return table.unpack(response, 1, response.n or #response)
  end

  if promise then
    -- Cancel this timer the instant the callback resolves normally. Previously it
    -- was never cleared, so every await left a 5-minute closure (holding the
    -- promise + event string) lingering in the scheduler — thousands rolling at
    -- scale. On a genuine no-answer it also clears the awaiting entry, which the
    -- old reject path never did (that entry leaked forever on any un-answered call).
    local timer = SetTimeout(callback_timeout, function()
      awaitingCallbacks[key] = nil
      promise:reject(('Callback %s timed out'):format(event))
    end)

    local response = Citizen.Await(promise)
    ClearTimeout(timer)
    return table.unpack(response)
  end
end


lib.callback = setmetatable({}, {
  __call = function(_, event, cb, ...)
    if not cb then 
      warn(('Callback %s does not have a callback'):format(event))
    else 
      if type(cb) == 'number' then 
        lib.print.warn(('Callback %s : 2nd argument should be a function not a number, ignored for now'):format(event))
        local rawArgs = {...}
        cb = rawArgs[1]
      end   
      local cbType = type(cb)
      assert(cbType == 'function', ('Callback %s must have a function for argument 2'):format(event))
    end

    return triggerServerCallback(_, event, cb, nil, ...)
  end
})


--- ox_lib's signature is `await(event, delay, ...)`, where `delay` is a
--- timeout in ms or `false` for none. dirk_lib has no timeout, so it never had
--- that slot - which means `await(event, false, payload)` quietly delivered
--- `false` as the callback's FIRST argument and the real payload as its
--- second. Every such call looked fine and did nothing, because handlers
--- written as `function(src, payload)` saw `payload == false` and bailed on
--- their own type check.
---
--- Muscle memory writes the ox form, so accept it: a leading `false` is the
--- ox delay slot and is dropped. Only `false` - a leading number could be a
--- real argument, and no callback in practice takes the literal `false` as its
--- first.
--- Like await, but gives up after `timeoutMs` and returns nil, 'Timeout'.
--- For calls at another resource whose state you do not control - it may be
--- mid-restart, and a panel must degrade for one script rather than freeze.
lib.callback.awaitTimeout = function(event, timeoutMs, ...)
  return triggerServerCallback(nil, event, nil, tonumber(timeoutMs) or 5000, ...)
end

lib.callback.await = function(event, ...)
  local first = ...
  if first == false then
    return triggerServerCallback(_, event, nil, nil, select(2, ...))
  end
  return triggerServerCallback(_, event, nil, nil, ...)
end


local callbackResponse = function(success,result, ...)
  if not success then
    if result then
      return print(('^1SCRIPT ERROR: %s^0\n%s'):format(result,
      Citizen.InvokeNative(`FORMAT_STACK_TRACE` & 0xFFFFFFFF, nil, 0, Citizen.ResultAsString()) or ''))
    end

    return false
  end

  return result, ...
end

local pcall = pcall


lib.callback.register = function(event, cb)
  if not cb then 
    warn(('Callback %s does not have a callback'):format(event))
  else 
    local cbType = type(cb)
    assert(cbType == 'function', ('Callback %s must have a function for argument 2'):format(event))
  end

  RegisterNetEvent(callback_event:format(event), function(resource, key, ...)
    TriggerServerEvent(callback_event:format(resource), key, callbackResponse(pcall(cb, ...)))
  end)
end


return lib.callback
