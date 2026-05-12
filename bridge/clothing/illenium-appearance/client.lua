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
    exports[lib.settings.clothing]:setPlayerModel(model)
  end,

  -- Open the appearance UI for a new character.
  --
  -- illenium-appearance is a drop-in replacement for either qb-clothing or
  -- esx_skin and only initialises its "new character" flow (initial clothes,
  -- routing-bucket swap, NewCharacterSections config) when triggered through
  -- the framework's standard event — NOT when you call its raw
  -- `startPlayerCustomization` export. Calling the export directly puts the
  -- player in customization mode internally but never sends the NUI message
  -- that actually renders the UI, so it looks like nothing happens.
  --
  -- For QB / QBX we trigger `qb-clothes:client:CreateFirstCharacter` and for
  -- ESX we trigger `esx_skin:openSaveableMenu`. The ESX path supports
  -- onSubmit / onCancel callbacks. The QB path doesn't, so we poll the NUI
  -- focus state with a small grace period to detect close.
  openCustomisation = function(categories)
    local prom = promise.new()
    local fw = lib.settings.framework

    if fw == "qb-core" or fw == "qbx_core" then
      TriggerEvent("qb-clothes:client:CreateFirstCharacter")
      CreateThread(function()
        -- Grace period for illenium to open its NUI before we start polling
        -- it closing again.
        Wait(1500)
        while IsNuiFocused() do Wait(200) end
        prom:resolve("ok")
      end)
    elseif fw == "es_extended" then
      TriggerEvent(
        "esx_skin:openSaveableMenu",
        function() prom:resolve("ok") end,
        function() prom:resolve("cancelled") end
      )
    else
      -- Standalone / ox-core / unknown framework: call illenium's raw export.
      -- Works on some configurations even without framework wiring, and at
      -- least doesn't break this fallback path.
      exports[lib.settings.clothing]:startPlayerCustomization(function()
        prom:resolve("ok")
      end)
    end

    return Citizen.Await(prom)
  end,
}
