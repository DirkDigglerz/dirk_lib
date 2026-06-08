DevTool.register('vector4', {
  label = 'Vector4',
  command = true, 
  description = 'Copy the current position and heading to the clipboard',
  icon = 'paste',
  action = function()
    local coords = GetEntityCoords(cache.ped)
    local heading = GetEntityHeading(cache.ped)
    local vec = vector4(coords.x, coords.y, coords.z, heading)
    local vecString = ('vector4(%s, %s, %s, %s)'):format(vec.x, vec.y, vec.z, vec.w)
    lib.copyToClipboard(vecString)
  end
})

DevTool.register('vector3', {
  label = 'Vector3',
  command = true, 
  description = 'Copy the current position to the clipboard',
  icon = 'paste',
  action = function()
    local coords = GetEntityCoords(cache.ped)
    local vec = vector3(coords.x, coords.y, coords.z)
    local vecString = ('vector3(%s, %s, %s)'):format(vec.x, vec.y, vec.z)
    lib.copyToClipboard(vecString)
  end
})

DevTool.register('vector2', {
  label = 'Vector2',
  command = true, 
  description = 'Copy the current position to the clipboard',
  icon = 'paste',
  action = function()
    local coords = GetEntityCoords(cache.ped)
    local vec = vector2(coords.x, coords.y)
    local vecString = ('vector2(%s, %s)'):format(vec.x, vec.y)
    lib.copyToClipboard(vecString)
    
  end
})
