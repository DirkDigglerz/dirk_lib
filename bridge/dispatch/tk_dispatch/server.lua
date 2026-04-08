return {
  alert = function(src, data)
    local coords = data.coords or GetEntityCoords(GetPlayerPed(src))
    exports['tk_dispatch']:SendDispatch({
      coords      = type(coords) == 'vector3' and coords or vector3(coords.x, coords.y, coords.z),
      message     = data.message or 'Alert',
      code        = data.code or '10-90',
      priority    = data.level or 3,
      jobs        = { 'police', 'sheriff' },
    })
  end,
}
