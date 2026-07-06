-- lib.garage — vehicle-storage abstraction.
--
-- Any script stores a completed / purchased vehicle with ONE call and dirk_lib
-- routes it to the right place:
--   garage-system bridge (own storage / quirks)  →  framework bridge
-- The framework bridge does a SCHEMA-AWARE insert into the framework's own
-- vehicle table (owned_vehicles / player_vehicles) or the framework's native
-- vehicle API — so it works for every garage that reads the framework table
-- (jg-advancedgarages, qb-garages, cd_garage, okokGarage, renewed…) without a
-- dedicated bridge. Garages with their OWN storage (e.g. wasabi) get a
-- bridge/garage/<resource>/server.lua that implements addVehicle and wins.
--
-- Motivating bug: dirk_projectCars hard-coded `INSERT INTO owned_vehicles
-- (owner, plate, vehicle, garage)`, which died with "Unknown column 'garage'"
-- on ESX + jg-advancedgarages (no `garage` column). The schema-aware framework
-- insert below only writes columns that actually exist.

local settings = lib.settings
local garageBridge    = lib.loadBridge('garage', settings.garage, 'server')
local frameworkBridge = lib.loadBridge('framework', settings.framework, 'server')

return {
  ---@function lib.garage.addVehicle
  ---@description # Store a vehicle in a player's garage.
  ---@param src number Player server id (used to resolve the owner when not given)
  ---@param opts { model: string, plate?: string, props?: table, garage?: string, owner?: string, license?: string, vehicleType?: string }
  ---@return string|false # the plate on success, or false + reason on failure
  addVehicle = garageBridge.addVehicle or frameworkBridge.addVehicle or function()
    lib.print.warn('lib.garage.addVehicle: neither the garage nor framework bridge implements addVehicle')
    return false, 'NoBridge'
  end,
}
