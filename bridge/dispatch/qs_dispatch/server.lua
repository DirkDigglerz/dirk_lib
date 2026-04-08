return {
  alert = function(src, data)
    local coords = data.coords or GetEntityCoords(GetPlayerPed(src))
    exports['qs-dispatch']:CustomAlert({
      coords      = type(coords) == 'vector3' and coords or vector3(coords.x, coords.y, coords.z),
      job         = { 'police', 'sheriff' },
      callData    = {
        { icon = 'fa-exclamation-triangle', info = data.message or 'Alert' },
      },
      message     = data.message or 'Alert',
      flashes     = true,
      priority    = data.level or 3,
      blip = {
        sprite  = data.blipSprite or 161,
        scale   = data.blipScale or 1.0,
        colour  = data.blipColor or 1,
        flashes = true,
        text    = data.message or 'Alert',
        time    = (data.duration or 10000) / 1000,
      },
    })
  end,
}
