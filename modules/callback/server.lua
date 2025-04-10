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
    SetTimeout(callback_timeout, function() promise:reject(('Callback %s timed out'):format(event)) end)

    return table.unpack(Citizen.Await(promise))
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

lib.callback.register = function(name,cb)
  RegisterNetEvent(callback_event:format(name), function(resource, key, ...)
    TriggerClientEvent(callback_event:format(resource), source, key, callbackResponse(pcall(cb, source, ...)))
  end)
end

return lib.callback
