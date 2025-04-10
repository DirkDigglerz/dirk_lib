-- Adapted from ox_lib (https://github.com/overextended/ox_lib/blob/master/imports/callback/client.lua)
-- Licensed under LGPL-3.0: https://www.gnu.org/licenses/lgpl-3.0.html
-- and is used under the same license.

local awaitingCallbacks = {}
local timers = {}
local callback_event = '__dirk_cb_%s'
local callback_timeout = 300000 


RegisterNetEvent(callback_event:format(cache.resource), function(key, ...)
  local cb = awaitingCallbacks[key]
  awaitingCallbacks[key] = nil
  return cb and cb(...)
end)






local triggerServerCallback = function(_,event, cb, ...)
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

  if promise then 
    SetTimeout(callback_timeout, function() promise:reject(('Callback %s timed out'):format(event)) end)

    return table.unpack(Citizen.Await(promise))
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

    return triggerServerCallback(_, event, cb, ...)
  end
})


lib.callback.await = function(event, ...)
  return triggerServerCallback(_, event, nil, ...)
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
