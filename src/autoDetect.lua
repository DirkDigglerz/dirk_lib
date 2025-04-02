local supportedResources = {
  framework         = {'es_extended', 'qbx_core', 'qb-core'},
  inventory         = {'dirk_inventory', 'ox_inventory', 'qb-inventory', 'qs-inventory', 'codem-inventory', 'tgiann_inventory'},
  target            = {'ox_target', 'qb-target', 'q-target'},
  interact          = {'sleepless_interact'},
  time              = {'av_weather', 'cd_easytime', 'qb-weathersync', 'Renewed-Weathersync', 'vSync'},
  keys              = {'cd_garage', 'MrNewbVehicleKeys', 'okokGarage', 'qb-vehiclekeys', 'qbx_vehiclekeys', 'qs-vehiclekeys', 'Renewed-Vehiclekeys', 't1ger_keys', 'vehicles_keys', 'wasabi_carlock'},
  fuel              = {'cdn-fuel', 'LegacyFuel', 'ox_fuel', 'ps-fuel', 'Renewed-Fuel', 'ti_fuel', 'x-fuel'},
  phone             = {},
  garage            = {},
  ambulance         = {},
  prison            = {},
  dispatch          = {},
}

local autodetected = {}
print('------------------------------------------------')
print('^2RESOURCE AUTODETECTION^7')
print('------------------------------------------------')
for system, resources in pairs(supportedResources) do 
  for _, resource in ipairs(resources) do 
    local resourceState = GetResourceState(resource) 
    if resourceState == 'starting' or resourceState == 'started' then 
      print(('%s : %s'):format(string.upper(system), resource))
      autodetected[system] = resource 
      goto continue
    end
  end 
  ::continue:: 
end 
print('------------------------------------------------')

return autodetected