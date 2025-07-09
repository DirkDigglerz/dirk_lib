return {
  setSkin = function(ped, skin)
    local playerPed = ped or cache.ped
    if not skin then return end
    exports[lib.settings.clothing]:setPedAppearance(ped, skin)
  end,

  openCustomisation = function(categories)
    local promise = promise.new()
    exports[lib.settings.clothing]:startPlayerCustomization(function()
      promise:resolve('ok')
    end)
    return Citizen.Await(promise)
  end,

}
