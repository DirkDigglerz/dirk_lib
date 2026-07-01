local supportedResources = {
  framework         = {'es_extended', 'qbx_core', 'qb-core', 'nd-framework'},
  -- Order matters. Real drop-in inventories are listed BEFORE the generic
  -- framework names they impersonate via `provide` (ox_inventory / qb-inventory),
  -- so e.g. qs-inventory (which declares `provide 'qb-inventory'`) wins over the
  -- qb-inventory it shadows. The two provided/generic names go LAST so they only
  -- win on a server that genuinely runs them with no drop-in present.
  inventory         = {'dirk_inventory', 'one_inventory', 'qs-inventory', 'codem-inventory', 'tgiann-inventory', 'mf-inventory', 'core_inventory', 'ak47_inventory', 'ox_inventory', 'qb-inventory'},
  target            = {'ox_target', 'qb-target', 'q-target', 'bt-target'},
  interact          = {'redm-uiprompt', 'sleepless_interact', 'interact'},
  time              = {'av_weather', 'cd_easytime', 'qb-weathersync', 'Renewed-Weathersync', 'vSync', 'wasabi_wheather'},
  keys              = {'cd_garage', 'MrNewbVehicleKeys', 't1ger_keys', 'okokGarage', 'qb-vehiclekeys', 'qbx_vehiclekeys', 'qs-vehiclekeys', 'Renewed-Vehiclekeys', 'vehicles_keys', 'wasabi_carlock', 'ludaro-keys'},
  fuel              = {'cdn-fuel', 'LegacyFuel', 'ox_fuel', 'ps-fuel', 'Renewed-Fuel', 'ti_fuel', 'x-fuel', 'wasabi_fuel', 'okokGasStation', 'qs-fuelstations'},
  phone             = {'lb-phone', 'qb-phone', 'gksphone', 'high-phone', 'npwd'},
  garage            = {'qb-garages', 'wasabi_garage', 'renewed-garage'},
  clothing          = {'esx_skin', 'qb-clothing', 'rcore_clothing', 'illenium-appearance', 'fivem-appearance', 'dirk_charCreator', 'tgiann-clothing'},
  ambulance         = {'qb-ambulancejob', 'wasabi_ambulance', 'core_ambulance'},
  prison            = {'qb-prison', 'rcore_prison', 'wasabi_jail'},
  dispatch          = {'bub_mdt', 'cd_dispatch', 'linden_outlawalert', 'qs_dispatch', 'ps-dispatch', 'tk_dispatch'},
  doorlock          = {'ox_doorlock', 'qb-doorlock', 'nui_doorlock', 'doors_creator'},
  skills            = {'sd_skills', 'evolent_skills', 'core_skills', 'B1-skillz', 'skill_system_v1.5',  'skillsystem_v3', 'boii_skills', 'skillsystem_v2', 'ot_skill_system'},
  housing           = {'qs-housing', 'rtx_housing', 'bcs_housing', 'origen_housing'},
}

local imagePaths = {
  ['dirk_inventory'] = 'nui://dirk_inventory/web/images/',
  ['one_inventory']  = 'nui://one_inventory/web/images/',
  ['ox_inventory']   = 'nui://ox_inventory/web/images/',
  ['qb-inventory'] = 'nui://qb-inventory/html/images/',
  ['qs-inventory'] = 'nui://qs-inventory/html/images/',
  ['codem-inventory'] = 'nui://codem-inventory/html/images/',
  ['tgiann-inventory'] = 'nui://tgiann-inventory/html/images/',
  ['mf-inventory'] = 'nui://mf-inventory/html/images/',
  ['core_inventory'] = 'nui://core_inventory/html/img/',
  ['ak47_inventory'] = 'nui://ak47_inventory/html/images/',
}

local autodetected = {}

for system, resources in pairs(supportedResources) do 
  for _, resource in ipairs(resources) do 
    local resourceState = GetResourceState(resource)
    -- Only count a resource that's actually (re)starting or started. The old
    -- `or resourceState ~= 'missing'` also matched 'stopped'/disabled resources
    -- (e.g. a qb-inventory left in _disabled, or one shadowed by a `provide`),
    -- which caused false picks. Started/starting only.
    if resourceState == 'starting' or resourceState == 'started' then
      autodetected[system] = resource 

      if system == 'inventory' then
        -- `inventory:imagepath` is ox_inventory's OWN convar (CDN override). Only honour it
        -- when the detected inventory is actually ox_inventory — applying it to other
        -- inventories used to override their correct nui:// image path with an ox/CDN value
        -- that doesn't apply, breaking item images (reported on core_inventory by 62i).
        -- Every other inventory uses its known image path; users wanting a CDN can still set
        -- the dirk_lib `itemImgPath` setting directly.
        local oxConvar = resource == 'ox_inventory' and GetConvar('inventory:imagepath', '') or ''
        if oxConvar ~= '' then
          -- Ensure trailing slash
          if oxConvar:sub(-1) ~= '/' then oxConvar = oxConvar .. '/' end
          autodetected.itemImgPath = oxConvar
        else
          autodetected.itemImgPath = imagePaths[resource] or 'nui://dirk_inventory/web/images/'
        end
      end
      goto continue
    end
  end 
  autodetected[system] = autodetected[system] or 'NOT FOUND'
  ::continue:: 
end 

return autodetected

