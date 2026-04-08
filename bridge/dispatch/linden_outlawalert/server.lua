return {
  alert = function(src, data)
    local coords = data.coords or GetEntityCoords(GetPlayerPed(src))
    TriggerEvent('linden_outlawalert:dispatch', {
      dispatchCode = data.code or '10-90',
      description  = data.message or 'Alert',
      isImportant  = (data.level or 3) >= 3,
      recipientList = {},
      length       = data.duration or 10000,
      blip = {
        sprite  = data.blipSprite or 161,
        scale   = data.blipScale or 1.0,
        colour  = data.blipColor or 1,
        flashes = true,
        text    = data.message or 'Alert',
        time    = (data.duration or 10000) / 1000,
      },
      coords = type(coords) == 'vector3' and coords or vector3(coords.x, coords.y, coords.z),
    })
  end,
}
