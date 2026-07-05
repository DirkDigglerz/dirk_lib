local supportedResources = {
  framework         = {'es_extended', 'qbx_core', 'qb-core', 'nd-framework'},
  -- Order matters. Real drop-in inventories are listed BEFORE the generic
  -- framework names they impersonate via `provide` (ox_inventory / qb-inventory),
  -- so e.g. qs-inventory (which declares `provide 'qb-inventory'`) wins over the
  -- qb-inventory it shadows. The two provided/generic names go LAST so they only
  -- win on a server that genuinely runs them with no drop-in present.
  -- devix-inventory ships an ox_inventory compat STUB (only AddItem/RemoveItem/
  -- GetItemCount), so it must be detected BEFORE ox_inventory or dirk_lib would
  -- pick the stub instead of the real devix bridge.
  inventory         = {'dirk_inventory', 'one_inventory', 'qs-inventory', 'codem-inventory', 'tgiann-inventory', 'devix-inventory', 'mf-inventory', 'core_inventory', 'ak47_inventory', 'ox_inventory', 'qb-inventory'},
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
  -- devix stores item icons under html/img (confirmed by _i23, a devix user:
  -- "devix-inventory\html\img"). NOT the html/images convention the other
  -- inventories use. Override via the dirk_lib itemImgPath setting if a future
  -- devix build moves them.
  ['devix-inventory'] = 'nui://devix-inventory/html/img/',
}

-- Detection is a FUNCTION, not a one-shot module body, so it can be re-run after
-- boot. `lib.require` memoizes module results, so the old "compute at require
-- time and return the table" form froze whatever resource states existed the
-- instant dirk_lib booted. If an inventory resource started AFTER dirk_lib (very
-- common — libraries are ensured early), the itemImgPath baked to the fallback
-- and never recovered without a full dirk_lib restart (reported by 62i: fish
-- store images blank on boot, only appear after restarting lib + the script).
-- src/settingsOverlay re-runs this once the inventory is up and re-broadcasts.
local function detect()
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
            local path = imagePaths[resource] or 'nui://dirk_inventory/web/images/'
            -- tgiann-inventory: OLDER builds keep their item icons in a SEPARATE
            -- `inventory_images` resource (images/ subfolder), not in
            -- tgiann-inventory/html/images. Auto-redirect to it when that resource
            -- is present so those servers get icons with no manual itemImgPath
            -- override (reported by edmondio, on an old tgiann he can't upgrade).
            -- Newer tgiann has no inventory_images resource, so this is a no-op there.
            if resource == 'tgiann-inventory' then
              local imgRes = GetResourceState('inventory_images')
              if imgRes == 'started' or imgRes == 'starting' then
                path = 'nui://inventory_images/images/'
              end
            end
            autodetected.itemImgPath = path
          end
        end
        goto continue
      end
    end
    autodetected[system] = autodetected[system] or 'NOT FOUND'
    ::continue::
  end

  return autodetected
end

-- Exposed so the post-boot re-detection (settingsOverlay) can recompute fresh —
-- `require` would just hand back this same memoized boot snapshot.
lib.detectResources = detect

return detect()

