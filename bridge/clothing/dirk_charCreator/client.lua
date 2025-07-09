return {
  setSkin = function(ped, skin)
    local playerPed = ped or cache.ped
    if not skin then return end
    exports[lib.settings.clothing]:setPedAppearance(ped, skin)
  end,

  openCustomisation = function(categories)
    return exports.dirk_charCreator:startPlayerCustomization({
      canClose = false, 
    }) 
  end,

}
