local supportedResources = {
  framework         = {'es_extended', 'qbx_core', 'qb-core', 'nd-framework', 'pork_core'},
  inventory         = {'dirk_inventory', 'ox_inventory', 'qb-inventory', 'qs-inventory', 'codem-inventory', 'tgiann_inventory', 'mf-inventory', 'core_inventory'},
  target            = {'ox_target', 'qb-target', 'q-target', 'bt-target'},
  interact          = {'redm-uiprompt', 'sleepless_interact', 'interact'},
  time              = {'av_weather', 'cd_easytime', 'qb-weathersync', 'Renewed-Weathersync', 'vSync', 'wasabi_wheather'},
  keys              = {'cd_garage', 'MrNewbVehicleKeys', 't1ger_keys', 'okokGarage', 'qb-vehiclekeys', 'qbx_vehiclekeys', 'qs-vehiclekeys', 'Renewed-Vehiclekeys', 'vehicles_keys', 'wasabi_carlock', 'ludaro-keys'},
  fuel              = {'cdn-fuel', 'LegacyFuel', 'ox_fuel', 'ps-fuel', 'Renewed-Fuel', 'ti_fuel', 'x-fuel', 'wasabi_fuel', 'okokGasStation'},
  phone             = {'lb-phone', 'qb-phone', 'gksphone', 'high-phone', 'npwd'},
  garage            = {'qb-garages', 'wasabi_garage', 'renewed-garage'},
  clothing          = {'esx_skin', 'qb-clothing', 'rcore_clothing', 'illenium-appearance', 'fivem-appearance', 'dirk_charCreator', 'tgiann_clothing'},
  ambulance         = {'qb-ambulancejob', 'wasabi_ambulance', 'core_ambulance'},
  prison            = {'qb-prison', 'rcore_prison', 'wasabi_jail'},
  dispatch          = {'bub_mdt', 'cd_dispatch', 'linden_outlawalert', 'qs_dispatch', 'ps-dispatch', 'tk_dispatch'},
  skills            = {'sd_skills', 'evolent_skills', 'core_skills', 'B1-skillz', 'skill_system_v1.5',  'skillsystem_v3', 'boii_skills', 'skillsystem_v2', 'ot_skill_system'},
  housing           = {'qs-housing', 'bcs_housing'},
}

local imagePaths = {
  ['dirk_inventory'] = 'nui//dirk_inventory/web/images/',
  ['ox_inventory']   = 'nui://ox_inventory/web/images/',
  ['qb-inventory'] = 'nui://qb-inventory/html/images/',
  ['qs-inventory'] = 'nui://qs-inventory/html/images/',
  ['codem-inventory'] = 'nui://codem-inventory/html/images/',
  ['tgiann_inventory'] = 'nui://tgiann_inventory/html/images/',
  ['mf-inventory'] = 'nui://mf-inventory/html/images/',
  ['core_inventory'] = 'nui://core_inventory/html/images/',
}

local autodetected = {}

for system, resources in pairs(supportedResources) do 
  for _, resource in ipairs(resources) do 
    local resourceState = GetResourceState(resource) 
    if resourceState == 'starting' or resourceState == 'started' or resourceState ~= 'missing' then
      autodetected[system] = resource 

      if system == 'inventory' then 
        autodetected.itemImgPath = imagePaths[resource] or 'nui//dirk_inventory/images/items/'
      end 
      goto continue
    end
  end 
  autodetected[system] = autodetected[system] or 'NOT FOUND'
  ::continue:: 
end 

return autodetected

