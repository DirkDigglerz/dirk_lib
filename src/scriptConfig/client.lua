-- --------------------------------------------------
-- GLOBAL /dirk_config CLIENT HANDLER
-- --------------------------------------------------
-- Receives the chooser list from the server, opens dirk_lib's own NUI, and
-- forwards the selected resource back for dispatch.

local chooserOpen = false

local function closeChooser()
  if not chooserOpen then return end
  chooserOpen = false
  SendNuiMessage(json.encode({ action = 'CLOSE_SCRIPT_CONFIG_CHOOSER' }))
  SetNuiFocus(false, false)
end

RegisterNetEvent('dirk_lib:openScriptConfigChooser', function(list)
  if chooserOpen then return end
  chooserOpen = true

  SetNuiFocus(true, true)
  SendNuiMessage(json.encode({
    action = 'OPEN_SCRIPT_CONFIG_CHOOSER',
    data = { scripts = list or {} },
  }))
end)

-- Polled by per-script CONFIG_PANEL_BACK handlers so they can drop their
-- own NUI focus claim only AFTER we've taken focus on this resource.
-- TriggerEvent doesn't cross resources on the client, so an export poll
-- is the simplest race-free signal.
exports('isScriptConfigChooserOpen', function()
  return chooserOpen
end)

RegisterNuiCallback('SCRIPT_CONFIG_CHOOSER_PICK', function(data, cb)
  chooserOpen = false
  -- Don't release NUI focus: the picked resource will take over and re-grab
  -- focus. Releasing here causes a brief frame where the player's character
  -- can move/look around between the chooser closing and the consumer UI
  -- mounting.

  local resource = data and data.resource
  if type(resource) == 'string' and resource ~= '' then
    TriggerServerEvent('dirk_lib:scriptConfigChooserPick', resource)
  end

  cb({ success = true })
end)

RegisterNuiCallback('SCRIPT_CONFIG_CHOOSER_CLOSE', function(_, cb)
  closeChooser()
  cb({ success = true })
end)

-- Called by a consumer's scriptConfig module once it has finished grabbing
-- NUI focus. Lets the chooser release its lingering focus claim without
-- creating the focus gap that prompted us to keep it held during pick.
exports('releaseScriptConfigChooserFocus', function()
  if chooserOpen then return end
  SetNuiFocus(false, false)
end)

-- --------------------------------------------------
-- SCRIPT STUDIO
-- --------------------------------------------------
-- The hub that replaces the chooser. The server hands over the schemas this
-- player may edit; the VALUES are pulled per resource from that resource's own
-- permission-gated `getFullScriptConfig`, so server-only values keep travelling
-- through the one path that checks who is asking.

local studioOpen = false

local function closeStudio()
  if not studioOpen then return end
  studioOpen = false
  SendNuiMessage(json.encode({ action = 'CLOSE_SCRIPT_STUDIO' }))
  SetNuiFocus(false, false)
end

RegisterNetEvent('dirk_lib:openScriptStudio', function(focus)
  if studioOpen then return end
  studioOpen = true

  local scripts = lib.callback.await('dirk_lib:getScriptStudio')
  if type(scripts) ~= 'table' or #scripts == 0 then
    studioOpen = false
    lib.notify({ type = 'error', description = 'No script settings available.' })
    return
  end

  -- Values one resource at a time. Sequential on purpose: a callback per
  -- resource all at once would land as a burst of net events, and the panel
  -- cannot render before the first one arrives anyway.
  --
  -- getFullScriptConfig returns THREE values - success, error, payload - so
  -- `local ok, values = pcall(...)` bound `values` to the success boolean and
  -- every script arrived with no saved values at all. The panel then showed
  -- shipped defaults for everything and had nothing to diff a save against.
  for i = 1, #scripts do
    local entry = scripts[i]
    local ok, success, _err, payload = pcall(function()
      return lib.callback.await(('%s:getFullScriptConfig'):format(entry.resource))
    end)
    local got = (ok and success and type(payload) == 'table') and payload or nil
    entry.values = (got and type(got.config) == 'table') and got.config or {}
    -- The version this save will be checked against. Without it a save from a
    -- stale panel silently overwrites whatever changed underneath it.
    entry.clientVersion = got and got.clientVersion or nil
  end

  SetNuiFocus(true, true)
  SendNuiMessage(json.encode({
    action = 'OPEN_SCRIPT_STUDIO',
    data = { scripts = scripts, focus = focus },
  }))
end)

RegisterNUICallback('CLOSE_SCRIPT_STUDIO', function(_, cb)
  closeStudio()
  cb({})
end)

-- Losing the resource while the panel is open would leave NUI focus stuck.
AddEventHandler('onResourceStop', function(resource)
  if resource == GetCurrentResourceName() then closeStudio() end
end)

-- Proxy the per-resource, permission-gated callbacks the panel needs. The hub
-- renders every script, but each script still answers for its own data — so
-- these forward by resource name rather than dirk_lib answering on their behalf.
-- Deliberately NOT called GET_SCRIPT_CONFIG_HISTORY. `modules/scriptConfig`
-- registers a callback of that name too, and it loads lazily - so inside
-- dirk_lib it registered SECOND and quietly replaced this one. The Studio then
-- got the module's `{success, _error, data}` shape instead of the page, read no
-- `items` in it, and showed an empty change log however much was in the log.
RegisterNUICallback('GET_SCRIPT_STUDIO_HISTORY', function(payload, cb)
  local resource = type(payload) == 'table' and payload.resource
  if type(resource) ~= 'string' or resource == '' then return cb({ entries = {}, total = 0 }) end

  local ok, result = pcall(function()
    return lib.callback.await(('%s:getScriptConfigHistory'):format(resource), payload)
  end)
  cb((ok and type(result) == 'table') and result or { entries = {}, total = 0 })
end)


--- Save from the Script Studio.
---
--- The panel edits every script, but a script's config is written by that
--- script's own server callback — dirk_lib forwards, it does not answer on
--- their behalf, so each resource keeps enforcing its own permission gate.
---
--- The payload is a SECTION DELTA: only the top-level sections the admin
--- actually touched, each as its complete current value, with
--- `sectionReplace` so deletions inside a section propagate. Sending the whole
--- config would make one changed toggle rewrite everything.
RegisterNUICallback('SAVE_SCRIPT_STUDIO', function(payload, cb)
  local resource = type(payload) == 'table' and payload.resource
  if type(resource) ~= 'string' or resource == '' then
    return cb({ success = false, _error = 'NoResource' })
  end
  if type(payload.data) ~= 'table' then
    return cb({ success = false, _error = 'InvalidPayload' })
  end

  local ok, success, err, meta = pcall(function()
    return lib.callback.await(('%s:updateScriptConfig'):format(resource), {
      data            = payload.data,
      expectedVersion = payload.expectedVersion,
      sectionReplace  = true,
    })
  end)

  if not ok then return cb({ success = false, _error = 'CallbackFailed' }) end
  cb({ success = success == true, _error = err, meta = meta })
end)

--- Fetch a resource's own Script Studio component, as source.
---
--- The Studio is dirk_lib's NUI bundle, so a component living in another
--- resource's bundle is not something it can import - different bundle,
--- different origin. Lua has no such problem: LoadResourceFile reads any
--- started resource's declared files, so the code is fetched HERE and handed to
--- the panel to evaluate.
---
--- That also keeps the rule this whole design rests on: dirk_lib ships no
--- per-script code. It renders what a script gives it, sight unseen.
---
--- Only resources that actually declare `dirk_lib 'scriptConfig'` are readable,
--- and only from inside their own web build - so this cannot be used to read
--- arbitrary files out of arbitrary resources.
RegisterNUICallback('GET_STUDIO_COMPONENT', function(payload, cb)
  local resource = type(payload) == 'table' and payload.resource
  local path     = type(payload) == 'table' and payload.path

  if type(resource) ~= 'string' or type(path) ~= 'string' then
    return cb({ ok = false, _error = 'BadRequest' })
  end
  if GetResourceState(resource) ~= 'started' then
    return cb({ ok = false, _error = 'NotStarted' })
  end
  -- No traversal, and nothing outside the resource's built web assets.
  if path:find('%.%.') or not path:match('^web/build/[%w%-%._/]+%.js$') then
    return cb({ ok = false, _error = 'BadPath' })
  end

  local declares = false
  for i = 0, (GetNumResourceMetadata(resource, 'dirk_lib') or 0) - 1 do
    if GetResourceMetadata(resource, 'dirk_lib', i) == 'scriptConfig' then
      declares = true
      break
    end
  end
  if not declares then return cb({ ok = false, _error = 'NotAConsumer' }) end

  local source = LoadResourceFile(resource, path)
  if not source then return cb({ ok = false, _error = 'NotFound' }) end

  cb({ ok = true, source = source })
end)

--- Locale bundles for the Script Studio.
---
--- The panel resolves every label through the OWNING script's bundle, falling
--- back to English and then to the schema's own text - but nothing was ever
--- fetching those bundles, so `state.locales` stayed on its browser mock and
--- changing the language changed nothing on screen.
---
--- Fetched per language rather than all at once: fishing alone ships nine
--- files of ~900 keys, and sending every language on open would be most of a
--- megabyte to answer a question nobody has asked yet.
---
--- Consumer bundles are filtered to the keys the panel can actually use.
--- dirk_lib's own bundle comes whole, because it holds the panel's chrome.
RegisterNUICallback('GET_STUDIO_LOCALES', function(payload, cb)
  local language = type(payload) == 'table' and payload.language
  if type(language) ~= 'string' or language == '' or language:find('[^%w%-_]') then
    return cb({})
  end

  local resources = type(payload) == 'table' and payload.resources
  if type(resources) ~= 'table' then return cb({}) end

  local out = {}
  for i = 1, #resources do
    local resource = resources[i]
    if type(resource) == 'string' and GetResourceState(resource) == 'started' then
      local raw = LoadResourceFile(resource, ('locales/%s.json'):format(language))
      if raw then
        local ok, decoded = pcall(json.decode, raw)
        if ok and type(decoded) == 'table' then
          if resource == GetCurrentResourceName() then
            out[resource] = decoded
          else
            -- Only what the panel looks up. A script's gameplay strings are
            -- its own business and have no reason to cross into the panel.
            local slim = {}
            for key, value in pairs(decoded) do
              if type(key) == 'string'
                and (key:sub(1, 9) == 'settings.' or key:sub(1, 9) == 'sections.') then
                slim[key] = value
              end
            end
            if next(slim) then out[resource] = slim end
          end
        end
      end
    end
  end

  cb(out)
end)
