local time = lib.loadBridge('time', lib.settings.time, 'client')

lib.game = {
  syncTime = function(state)
    if not time.syncTime then return lib.print.error(('No bridge found for syncing time for %s'):format(lib.settings.time)) end
    return time.syncTime(state)  
  end,
}

return lib.game