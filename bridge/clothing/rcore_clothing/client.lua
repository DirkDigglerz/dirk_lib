return {
  setSkin = function(ped, skin)
    local playerPed = ped or cache.ped
    if not skin then return end
    exports["rcore_clothing"]:setPedSkin(ped, skin)
  end,

  openCustomisation = function(categories)
    local result = promise.new()
    TriggerEvent("esx_skin:openSaveableMenu", 
      function()
        result:resolve(true)
      end, function()
        result:resolve(false)
    end)
    return Citizen.Await(result)
  end,

}
