return {
  setModel = function(ped, model)
    local playerPed = ped or cache.ped
    if not model then return end
    exports[lib.settings.clothing]:setPlayerModel(playerPed, model)
  end,

  setSkin = function(ped, skin, model)
    local playerPed = ped or cache.ped
    if not skin then return end
    exports[lib.settings.clothing]:setPedAppearance(playerPed, skin)
    if not model then return end
    print("Setting model to ", model)
    exports[lib.settings.clothing]:setPlayerModel(model)
  end,

  openCustomisation = function(categories)
    print("illenium-appearance does not support categories")
    local promise = promise.new()
    print("Starting customization")
    exports[lib.settings.clothing]:startPlayerCustomization(function()
      promise:resolve('ok')
    end)
    return Citizen.Await(promise)
  end,

}
