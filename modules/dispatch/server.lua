local settings = lib.settings
local dispatchResource = settings.dispatch

local bridge
if dispatchResource and dispatchResource ~= 'NOT FOUND' then
  bridge = lib.loadBridge('dispatch', dispatchResource, 'server')
end

lib.dispatch = {
  ---Send a dispatch alert to law enforcement.
  ---@param src number Player source triggering the alert
  ---@param data table { message, level, coords, code, duration, blipSprite, blipScale, blipColor }
  alert = function(src, data)
    if bridge and bridge.alert then
      bridge.alert(src, data)
    else
      -- Fallback: notify all police players directly
      local coords = data.coords
      for _, playerId in ipairs(GetPlayers()) do
        local job = lib.player.getJob(tonumber(playerId))
        if job and (job.name == 'police' or job.name == 'sheriff' or job.name == 'leo') then
          TriggerClientEvent('dirk_lib:notify', tonumber(playerId), {
            title    = ('Dispatch [%s]'):format(data.code or '10-90'),
            description = data.message or 'Alert',
            type     = 'error',
            duration = data.duration or 8000,
          })
        end
      end
    end
  end,
}

return lib.dispatch
