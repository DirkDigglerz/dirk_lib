
local viewingModels = false 

local viewModels = function()
  
  if not viewingModels then return end
  local modelNames = lib.load('src.devtools.modelNames')
  CreateThread(function()
    while viewingModels do 
      local wait_time = 0 
      local pos = GetEntityCoords(cache.ped)
      local objects = GetGamePool('CObject')
      local nearbyObjects = {}
      for k,v in pairs(objects) do 
        local objPos = GetEntityCoords(v)
        local dist = #(pos - objPos)
        if dist < 5.0 then 
          local visible = IsEntityOnScreen(v) and not IsEntityOccluded(v) 
          if visible then 
            table.insert(nearbyObjects, v)
          end 
        end 
      end 


      for k,v in pairs(nearbyObjects) do 
        local objPos = GetEntityCoords(v)
        local ent_model = GetEntityModel(v)
        local ent_health = GetEntityHealth(v)
        lib.drawText3D(objPos.x, objPos.y, objPos.z, 1.0, 1.0, ('%s\n%s'):format(modelNames[ent_model] or ent_model or 'Unknown Model', ent_health or 'Unknown Health'), 255, 255, 255, 255)  
      end

      Wait(wait_time)
    end 
    modelNames = nil
    -- lua collect garbage
    collectgarbage()
  end)
end 

local toggleViewModels = function()
  viewingModels = not viewingModels
  viewModels()
end

DevTool.register('viewModels', {
  label = 'View Models',
  command = true, 
  description = 'Toggle viewing nearby object models',
  icon = 'eye',
  action = toggleViewModels
})  


