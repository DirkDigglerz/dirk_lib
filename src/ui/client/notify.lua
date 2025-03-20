local types = {
  ['error'] = {
    title     = 'Error',
    titleColor = 'rgba(155, 0, 0, 0.8)',
    icon      = 'fas fa-exclamation-circle',
    iconColor = 'rgba(155, 0, 0, 0.8)',
    iconBg    = 'rgba(155, 0, 0, 0.2)',
  },
  ['success'] = {
    title     = 'Success',
    titleColor = 'rgba(0, 155, 0, 0.8)',
    icon      = 'fas fa-check-circle',
    iconColor = 'rgba(0, 155, 0, 0.8)',
    iconBg    = 'rgba(0, 155, 0, 0.2)',
  },
  ['inform'] = {
    title      = 'Information',
    titleColor = 'rgba(0, 155, 0, 0.8)',
    icon       = 'fas fa-info-circle',
    iconColor  = 'rgba(0, 155, 0, 0.8)',
    iconBg     = 'rgba(0, 155, 0, 0.2)',
  },
  ['warning']  = {
    title      = 'Warning',
    titleColor = 'rgba(155, 155, 0, 0.8)',
    icon       = 'fas fa-exclamation-triangle',
    iconColor  = 'rgba(155, 155, 0, 0.8)',
    iconBg     = 'rgba(155, 155, 0, 0.2)',
  },
}


lib.notify = function(data)
  if not cache.playerLoaded then return end
  if lib.settings.notify == 'ox_lib' then 
    return TriggerEvent('ox_lib:notify', data)
  end 

  while notification do Wait(0) end
  notification = true
  SetTimeout(100, function() notification = nil end)

  local settings = lib.settings
  if not settings.notify or settings.notify == 'dirk_lib' then
    local sound = settings.notifyAudio and data.sound
    data.title = data.title or data.type and types[data.type].title or 'Notification'
    data.titleColor = data.titleColor or types[data.type] and types[data.type].titleColor
    data.position = data.position or settings.notifyPosition or 'top-right'
    data.icon = data.icon or data.type and types[data.type] and types[data.type].icon or types['inform'].icon
    data.iconColor = data.iconColor or types[data.type] and types[data.type].iconColor
    data.iconBg = data.iconBg or types[data.type] and types[data.type].iconBg
    SendNuiMessage(json.encode({
      action = 'ADD_NOTIFICATION',
      data   = data
    }))

    if not sound then return end
    if sound.bank then lib.request.audioBank(sound.bank) end
    local soundId = GetSoundId()
    PlaySoundFrontend(soundId, sound.name, sound.set, true)
    ReleaseSoundId(soundId)
    if sound.bank then ReleaseNamedScriptAudioBank(sound.bank) end
  end
end

RegisterNetEvent('dirk_lib:notify', lib.notify)
RegisterNetEvent('dirk_lib:defaultNotify', lib.defaultNotify)

lib.defaultNotify = function(data)
  if lib.settings.notify == 'ox_lib' then 
    return TriggerEvent('dirk_lib:defaultNotify', data)
  end

  data.type = data.status
  if data.type == 'inform' then data.type = 'info' end
  return lib.notify(data)
end


-- Command to test all types of notifications
RegisterCommand('test_notify', function()
  lib.notify({
    type = 'error',
    description = 'This is an error notification',
    sound = { name = 'ERROR', set = 'HUD_LIQUOR_STORE_SOUNDSET' }
  })
  Wait(2500)
  lib.notify({
    type = 'success',
    description = 'This is a success notification',
    sound = { name = 'NAV', set = 'HUD_LIQUOR_STORE_SOUNDSET' }
  })
  Wait(1000)
  lib.notify({
    type = 'inform',
    description = 'This is an inform notification',
    sound = { name = 'NAV', set = 'HUD_LIQUOR_STORE_SOUNDSET' }
  })
  Wait(2500)
  lib.notify({
    type = 'warning',
    description = 'This is a warning notification',
    sound = { name = 'NAV', set = 'HUD_LIQUOR_STORE_SOUNDSET' }
  })
end, false)



