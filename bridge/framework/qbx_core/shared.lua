--- Reading the shipped table directly, rather than through
--- `exports['qb-core']:GetCoreObject().Shared.Vehicles`. qbx_core only answers
--- that export through its qb compatibility shim, and this is the same file the
--- shim serves — one less legacy surface to depend on, same data.
local vehicles

return {
  getObject = function()
    return exports['qb-core']:GetCoreObject()
  end,

  getVehicles = function()
    if vehicles then return vehicles end
    local chunk = LoadResourceFile('qbx_core', 'shared/vehicles.lua')
    if not chunk then return nil end
    local fn = load(chunk, '@@qbx_core/shared/vehicles.lua')
    if not fn then return nil end
    local ok, result = pcall(fn)
    vehicles = ok and type(result) == 'table' and result or nil
    return vehicles
  end,
}
