return {
  setSkin = function(ped, skin)
    local playerPed = ped or cache.ped
    if not skin then return end
    TriggerEvent('qb-clothing:client:loadPlayerClothing', skin, ped)
  end,

  openCustomisation = function(categories)
    TriggerEvent('qb-clothes:client:CreateFirstCharacter')
    if lib.settings.clothing == 'qb-clothing' then 
      while exports['qb-clothing']:IsCreatingCharacter() do Wait(500); end
    end
    return true 
  end,

}
