local supportedResources = {
  framework         = {'es_extended', 'qbx_core', 'qb-core', 'nd-framework'},
  inventory         = {'dirk_inventory', 'ox_inventory', 'qb-inventory', 'qs-inventory', 'codem-inventory', 'tgiann_inventory', 'mf-inventory', 'core_inventory'},
  target            = {'ox_target', 'qb-target', 'q-target', 'bt-target'},
  interact          = {'sleepless_interact'},
  time              = {'av_weather', 'cd_easytime', 'qb-weathersync', 'Renewed-Weathersync', 'vSync', 'wasabi_wheather'},
  keys              = {'cd_garage', 'MrNewbVehicleKeys', 'okokGarage', 'qb-vehiclekeys', 'qbx_vehiclekeys', 'qs-vehiclekeys', 'Renewed-Vehiclekeys', 't1ger_keys', 'vehicles_keys', 'wasabi_carlock', 'ludaro-keys'},
  fuel              = {'cdn-fuel', 'LegacyFuel', 'ox_fuel', 'ps-fuel', 'Renewed-Fuel', 'ti_fuel', 'x-fuel', 'wasabi_fuel'},
  phone             = {'lb-phone', 'qb-phone', 'gksphone', 'high-phone', 'npwd'},
  garage            = {'qb-garages', 'wasabi_garage', 'renewed-garage'},
  ambulance         = {'qb-ambulancejob', 'wasabi_ambulance', 'core_ambulance'},
  prison            = {'qb-prison', 'rcore_prison', 'wasabi_jail'},
  dispatch          = {'qb-dispatch', 'ps-dispatch', 'cd_dispatch', 'core_dispatch'},
}

local autodetected = {}

for system, resources in pairs(supportedResources) do 
  for _, resource in ipairs(resources) do 
    local resourceState = GetResourceState(resource) 
    if resourceState == 'starting' or resourceState == 'started' then 
      autodetected[system] = resource 
      goto continue
    end
  end 
  autodetected[system] = autodetected[system] or 'NOT FOUND'
  ::continue:: 
end 

return autodetected

