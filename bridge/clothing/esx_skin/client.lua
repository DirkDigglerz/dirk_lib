return {
  setSkin = function(ped, skin)
    local playerPed = ped or cache.ped
    if not skin then return end

    -- Face & skin
    SetPedHeadBlendData(playerPed, skin['face'], skin['face'], skin['face'], skin['skin'], skin['skin'], skin['skin'], 1.0, 1.0, 1.0, true)

    -- Hair
    SetPedComponentVariation(playerPed, 2, skin['hair_1'], skin['hair_2'], 2)
    SetPedHairColor(playerPed, skin['hair_color_1'], skin['hair_color_2'])

    -- Beard
    SetPedHeadOverlay(playerPed, 1, skin['beard_1'], (skin['beard_2'] or 0) / 10.0)
    SetPedHeadOverlayColor(playerPed, 1, 1, skin['beard_3'], skin['beard_4'])

    -- Eyebrows
    SetPedHeadOverlay(playerPed, 2, skin['eyebrows_1'], (skin['eyebrows_2'] or 0) / 10.0)
    SetPedHeadOverlayColor(playerPed, 2, 1, skin['eyebrows_3'], skin['eyebrows_4'])

    -- Age
    SetPedHeadOverlay(playerPed, 3, skin['age_1'], (skin['age_2'] or 0) / 10.0)

    -- Makeup
    SetPedHeadOverlay(playerPed, 4, skin['makeup_1'], (skin['makeup_2'] or 0) / 10.0)
    SetPedHeadOverlayColor(playerPed, 4, 1, skin['makeup_3'], skin['makeup_4'])

    -- Lipstick
    SetPedHeadOverlay(playerPed, 8, skin['lipstick_1'], (skin['lipstick_2'] or 0) / 10.0)
    SetPedHeadOverlayColor(playerPed, 8, 1, skin['lipstick_3'], skin['lipstick_4'])

    -- Ears
    if skin['ears_1'] == -1 then
      ClearPedProp(playerPed, 2)
    else
      SetPedPropIndex(playerPed, 2, skin['ears_1'], skin['ears_2'], 2)
    end

    -- Clothing
    SetPedComponentVariation(playerPed, 8,  skin['tshirt_1'],  skin['tshirt_2'], 2)
    SetPedComponentVariation(playerPed, 11, skin['torso_1'],   skin['torso_2'], 2)
    SetPedComponentVariation(playerPed, 3,  skin['arms'],      0, 2)
    SetPedComponentVariation(playerPed, 10, skin['decals_1'],  skin['decals_2'], 2)
    SetPedComponentVariation(playerPed, 4,  skin['pants_1'],   skin['pants_2'], 2)
    SetPedComponentVariation(playerPed, 6,  skin['shoes_1'],   skin['shoes_2'], 2)
    SetPedComponentVariation(playerPed, 1,  skin['mask_1'],    skin['mask_2'], 2)
    SetPedComponentVariation(playerPed, 9,  skin['bproof_1'],  skin['bproof_2'], 2)
    SetPedComponentVariation(playerPed, 7,  skin['chain_1'],   skin['chain_2'], 2)
    SetPedComponentVariation(playerPed, 5,  skin['bags_1'],    skin['bags_2'], 2)

    -- Helmet
    if skin['helmet_1'] == -1 then
      ClearPedProp(playerPed, 0)
    else
      SetPedPropIndex(playerPed, 0, skin['helmet_1'], skin['helmet_2'], 2)
    end

    -- Glasses
    SetPedPropIndex(playerPed, 1, skin['glasses_1'], skin['glasses_2'], 2)
  end,

  openCustomisation = function(categories)
    print('open customisation')
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
