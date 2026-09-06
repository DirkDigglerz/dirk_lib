-- type KeyInputProps = {
--   qwerty: string
--   label: string
--   icon: string
--   delay?: number
--   hidden?: boolean
--   pressed?: boolean
-- }
-- type DirectionProps = 'row' | 'column' | 'row-reverse' | 'column-reverse'
-- type PositionProps = 'top-right' | 'right-center' | 'bottom-right' | 'top-left' | 'left-center' | 'bottom-left' | 'bottom-center' | 'top-center' | { top?: string | number, right?: string | number, bottom?: string | number, left?: string | number, transform?: string } |
-- {  
-- top?: string | number
--   right?: string | number
--   bottom?: string | number
--   left?: string | number
--   transform?: string
-- }


local invoking_resource = nil
AddEventHandler('onResourceStop', function(resource)
  if resource == invoking_resource then
    lib.hideKeys()
  end
end)

local keyInputOpen = false
lib.showKeys = function(data)
  invoking_resource = GetInvokingResource()
  if keyInputOpen then
    lib.hideKeys()
  end
  assert(type(data) == 'table', 'arg must be a table for lib.showKeys')
  assert(type(data.position) == 'string' or type(data.position) == 'table', 'data.position must be a string or table for lib.showKeys')
  assert(type(data.inputs) == 'table', 'data.inputs must be a table for lib.showKeys')
  assert(#data.inputs > 0, 'data.inputs must have at least one input for lib.showKeys')

  for k,v in ipairs(data.inputs) do 
    assert(type(v.key) == 'string', 'data.inputs['..k..'].key must be a string for lib.showKeys even if its a number just put it in quotes')
    local key_info = lib.getKey(v.key)
    assert(key_info, 'data.inputs['..k..'].key must be a valid key for lib.showKeys')
    assert(type(v.label) == 'string', 'data.inputs['..k..'].label must be a string for lib.showKeys')
    assert(type(v.icon) == 'string', 'data.inputs['..k..'].icon must be a string for lib.showKeys')
    assert(type(v.delay) == 'number' or v.delay == nil, 'data.inputs['..k..'].delay must be a number or nil for lib.showKeys')
    
    v.qwerty         = key_info.qwerty
    v.control        = key_info.control
    v.canInteract    = v.canInteract and msgpack.unpack(msgpack.pack(v.canInteract)) or nil
    if not v.action then 
      v.action = function()
        if v.clientEvent then
          TriggerEvent(v.clientEvent, v.args and table.unpack(v.args) or nil)
        elseif v.serverEvent then
          TriggerServerEvent(v.serverEvent, v.args and table.unpack(v.args) or nil)
        elseif v.export then
          exports[v.export](v.args and table.unpack(v.args) or nil)
        end
      end
    end 
    v.action         = v.action and msgpack.unpack(msgpack.pack(v.action)) or nil
  end

  keyInputOpen = true

  SendNuiMessage(json.encode({
    action = 'SET_KEY_INPUTS',
    data = {
      position = data.position,
      inputs   = data.inputs,
      direction = data.direction or 'column'
    }
  }, {sort_keys = true}))


  
  CreateThread(function()
    while keyInputOpen do
      local changed_inputs = false 
      for index, control in pairs(data.inputs) do
        local is_hidden  = control.canIneract and not control.canIneract() or false
        DisableControlAction(1, tonumber(control.control), not is_hidden)
        local is_pressed = IsDisabledControlPressed(1, tonumber(control.control))
  
        if is_pressed and not control.delay then 
          control.action()
        end
  
        if control.pressed ~= is_pressed then
          changed_inputs = true
          control.pressed = is_pressed
        end
  
        if control.hidden ~= is_hidden then
          changed_inputs = true
          control.hidden = is_hidden
        end
      end  
      
      if changed_inputs then
        if #data.inputs == 0 then
          lib.hideKeys()
        else 
          if not keyInputOpen then return end
          SendNuiMessage(json.encode({
            action = 'SET_KEY_INPUTS',
            data = {
              position = data.position,
              direction = data.direction or 'column',
              inputs = data.inputs,
              theme = lib.uiTheme(invoking_resource),
            }
          }, {sort_keys = true}))
        end
      end
      
      Wait(0)
    end
  end)
end



lib.hideKeys = function()
  keyInputOpen = false
  SendNuiMessage(json.encode({
    action = 'HIDE_KEY_INPUTS'
  }))
end

lib.isKeysOpen = function()
  return keyInputOpen
end