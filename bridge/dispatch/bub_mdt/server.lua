return {
  alert = function(src, data)
    local coords = data.coords or GetEntityCoords(GetPlayerPed(src))
    exports['bub_mdt']:SendAlert({
      coords = type(coords) == 'vector3' and coords or vector3(coords.x, coords.y, coords.z),
      title  = data.code or '10-90',
      description = data.message or 'Alert',
      type   = 'emergency',
      blip = {
        sprite = data.blipSprite or 161,
        scale  = data.blipScale or 1.0,
        color  = data.blipColor or 1,
        text   = data.message or 'Alert',
      },
    })
  end,
}
