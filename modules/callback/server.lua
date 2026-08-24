-- Adapted from ox_lib (https://github.com/overextended/ox_lib/blob/master/imports/callback/server.lua)
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


local triggerClientCallback = function(_, event, playerId, cb, ...)
  assert(DoesPlayerExist(playerId), ('Player %s does not exist'):format(playerId))

  local key  
  repeat 
    key = ('%s_%s_%s'):format(event, math.random(0, 9999999), playerId)
  until not awaitingCallbacks[key]

  TriggerClientEvent(callback_event:format(event), playerId, cache.resource, key, ...)

  local promise = not cb and promise:new()

  awaitingCallbacks[key] = function(response, ...)
    response = {response, ...}

    if promise then 
      return promise:resolve(response)
    end 

    if cb then 
      cb(table.unpack(response))
    end
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
  __call = function(_, event, playerId, cb, ...)
    if not cb then 
      warn(('Callback %s does not have a callback'):format(event))
    else 
      local cbType = type(cb)
      assert(cbType == 'function', ('Callback %s must have a function for argument 3'):format(event))
    end

    return triggerClientCallback(_, event, playerId, cb, ...)
  end
})

lib.callback.await = function(event,playerId, ...)
  return triggerClientCallback(_, event, playerId, nil, ...)
end


-- Name the failing callback in the error print. Without it a handler error
-- surfaces as "SCRIPT ERROR: ?:-1: ..." with a wrapper-only trace — impossible
-- to tell WHICH of a resource's dozens of callbacks blew up from a customer's
-- console screenshot. debug.traceback(err) at pcall time captures the real
-- error site, unlike FORMAT_STACK_TRACE at response time.
local callbackResponse = function(name, success, result, ...)
  if not success then
    if result then
      print(('^1SCRIPT ERROR in callback %s: %s^0'):format(name, result))
    end
    return false  -- always return false on error, never nil
  end

  return result, ...
end


local pcall = pcall

lib.callback.register = function(name,cb)
  RegisterNetEvent(callback_event:format(name), function(resource, key, ...)
    local src = source
    TriggerClientEvent(callback_event:format(resource), src, key, callbackResponse(name, xpcall(cb, debug.traceback, src, ...)))
  end)
end

return lib.callback
