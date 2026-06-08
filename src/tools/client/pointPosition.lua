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

lib.getPosition = function(multiple, bounds)
  local points = {}

  local buttonInfo = {
    addSingle = 'Press ~INPUT_CONTEXT~ to confirm position',
    addPoint      = 'Press ~INPUT_CONTEXT~ to add point',
    confirm       = 'Press ~INPUT_MELEE_ATTACK_LIGHT~ to confirm position(s)',
    cancel = 'Press ~INPUT_THROW_GRENADE~ to cancel',
    delete = 'Press ~INPUT_FRONTEND_RRIGHT~ to delete point',

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

    local text = (multiple and buttonInfo.addPoint or buttonInfo.addSingle)..''..(multiple and '\n'..buttonInfo.delete..'\n'..buttonInfo.confirm or '')..'\n'..buttonInfo.cancel
    lib.showHelpNotification(text)

    for k,v in pairs(points) do 
      DrawMarker(1, v.x, v.y, v.z, 0, 0, 0, 0, 0, 0, 0.1, 0.1, 0.1, 255, 0, 0, 100, false, false, 2, false, false, false, false)
      Draw3DText(v.x, v.y, v.z, 1.0, ('Point %s'):format(k))
    end

    if IsControlJustPressed(0, 38) then 
      if multiple then 
        table.insert(points, endCoords)
      else 
        return endCoords
      end
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
        title = 'Copied Points',
        description = 'Copied points to clipboard',
        type = 'info',
      })
      lib.copyToClipboard(point_string)
      return point_string
    end

    Wait(0)
  end
end

DevTool.register('getPosition', {
  label = 'Get Position',
  command = true, 
  description = 'Get a position from the player',
  icon = 'crosshairs',
  action = function()
    lib.getPosition(true)
  end
})  

