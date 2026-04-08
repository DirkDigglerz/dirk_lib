return {
  alert = function(src, data)
    local coords = data.coords or GetEntityCoords(GetPlayerPed(src))
    TriggerEvent('cd_dispatch:AddNotification', {
      job_table   = { 'police', 'sheriff' },
      coords      = type(coords) == 'vector3' and coords or vector3(coords.x, coords.y, coords.z),
      title       = data.code or '10-90',
      message     = data.message or 'Alert',
      flash       = 0,
      unique_id   = tostring(math.random(100000, 999999)),
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
