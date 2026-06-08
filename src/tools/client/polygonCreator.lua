function Draw3DText(x, y, z, scl_factor, text)
  local onScreen, _x, _y = World3dToScreen2d(x, y, z)
  local p = GetGameplayCamCoords()
  local distance = GetDistanceBetweenCoords(p.x, p.y, p.z, x, y, z, 1)
  local scale = (1 / distance) * 2
  local fov = (1 / GetGameplayCamFov()) * 100
  local scale = scale * fov * scl_factor
  if onScreen then
    SetTextScale(0.0, scale)
    SetTextFont(0)
    SetTextProportional(1)
    SetTextColour(255, 255, 255, 215)
    SetTextDropshadow(0, 0, 0, 0, 255)
    SetTextEdge(2, 0, 0, 0, 150)
    SetTextDropShadow()
    SetTextOutline()
    SetTextEntry("STRING")
    SetTextCentre(1)
    AddTextComponentString(text)
    DrawText(_x, _y)
  end
end


local drawPolygon = function(polygon, height, color)
  for i = 1, #polygon do
    local thickness = vec(0, 0, height)
    local a = polygon[i] + thickness
    local b = polygon[i] - thickness
    local c = (polygon[i + 1] or polygon[1]) + thickness
    local d = (polygon[i + 1] or polygon[1]) - thickness
    DrawLine(a.x, a.y, a.z, b.x, b.y, b.z, color.r, color.g, color.b, 225)
    DrawLine(a.x, a.y, a.z, c.x, c.y, c.z, color.r, color.g, color.b, 225)
    DrawLine(b.x, b.y, b.z, d.x, d.y, d.z, color.r, color.g, color.b, 225)
    DrawPoly(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, color.r, color.g, color.b, color.a)
    DrawPoly(c.x, c.y, c.z, b.x, b.y, b.z, a.x, a.y, a.z, color.r, color.g, color.b, color.a)
    DrawPoly(b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z, color.r, color.g, color.b, color.a)
    DrawPoly(d.x, d.y, d.z, c.x, c.y, c.z, b.x, b.y, b.z, color.r, color.g, color.b, color.a)
  end
end

lib.createPolygon = function(bounds)
  local points = {}
  local height = 1.0
  local buttonInfo = {
    addPoint      = 'Press ~INPUT_CONTEXT~ to add point',
    confirm       = 'Press ~INPUT_MELEE_ATTACK_LIGHT~ to confirm polygon',
    cancel = 'Press ~INPUT_THROW_GRENADE~ to cancel',
    increaseHeight = 'Press ~INPUT_CELLPHONE_UP~ to increase height',
    decreaseHeight = 'Press ~INPUT_CELLPHONE_DOWN~ to decrease height',
    delete = 'Press ~INPUT_FRONTEND_RRIGHT~ to delete last point',
  }

  local isValidPos = function(coords)
    if not bounds then return true end
    if type(bounds) == 'table' then 
      local polygon = lib.zones.polyPointCheck(bounds, coords)
    else 
      local dist = #(startPos - coords)
      if dist > bounds then 
        return false
      end
    end 
    return true
  end

  

  while true do 
    local hit, endCoords, entityHit, surfaceNormal, materialHash = lib.raycast.fromCamera(nil, entity, type(bounds) == 'number' and bounds)

    if endCoords and entityHit ~= entity and isValidPos(endCoords) then 
      DrawSphere(endCoords.x, endCoords.y, endCoords.z, 0.1, 255, 0, 0, 100)
    end

    local text = buttonInfo.addPoint..'\n'..buttonInfo.delete..'\n'..('Height: %s'):format(height)..'\n'..buttonInfo.increaseHeight..'\n'..buttonInfo.decreaseHeight..'\n'..buttonInfo.confirm..'\n'..buttonInfo.cancel
    lib.showHelpNotification(text)

    drawPolygon(points, height, {r = 0, g = 255, b = 0, a = 80})

    for k,v in pairs(points) do 
      DrawMarker(1, v.x, v.y, v.z, 0, 0, 0, 0, 0, 0, 0.1, 0.1, 0.1, 255, 0, 0, 100, false, false, 2, false, false, false, false)
      Draw3DText(v.x, v.y, v.z, 1.0, ('Point %s'):format(k))
      DrawLine(v.x, v.y, v.z, v.x, v.y, v.z + height, 255, 0, 0, 100)
    end

    if IsControlJustPressed(0, 38) then
       table.insert(points, endCoords)
    elseif IsControlJustPressed(0, 172) then
      height = height + 1.0
    elseif IsControlJustPressed(0, 173) then
      height = height - 1.0
    elseif IsControlJustPressed(0, 58) then
      return false
    elseif IsControlJustPressed(0, 194) then
      table.remove(points)
    elseif IsControlJustPressed(0, 140) then
      local point_string = ''
      for k,v in pairs(points) do 
        point_string = point_string..('vector3(%s, %s, %s),\n'):format(math.floor(v.x * 100) / 100, math.floor(v.y * 100) / 100, math.floor(v.z * 100) / 100)
      end
      lib.notify({
        title = 'Copied Polygon',
        description = 'Copied polypoints to clipboard',
        type = 'info',
      })
      lib.copyToClipboard(point_string)
      return point_string
    end

    Wait(0)
  end
end

DevTool.register('polygonCreator', {
  label = 'Polygon Creator',
  command = true, 
  description = 'Create a polygon',
  icon = 'eye',
  action = function()
    lib.createPolygon()
  end
})  

