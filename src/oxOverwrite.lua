local disabledComponents = json.decode(GetConvar('prism:disabledComponents', '{}')) or {}
local module <const> = exports.dirk_lib
local IS_SERVER <const> = IsDuplicityVersion()
local debugMode = GetConvarInt('prism:debug', 0) == 1

if IS_SERVER then
    TriggerClientEvent = function(eventName, playerId, ...)
        local payload = msgpack.pack_args(...)

        if eventName == "ox_lib:notify" then
            eventName = "dirk_lib:notify"
            if debugMode then
                local resource = GetCurrentResourceName()
                print(("[DIRK_LIB-WARNING] We have changed your event destination from 'ox_lib:notify' to 'dirk_lib:notify' as it would've shown the default ox_lib notification. You do not have to change something, this is just an informative message. To disable this, disable debug mode.\nResource: %s")
                    :format(
                        resource
                    ))
            end
        end

        return TriggerClientEventInternal(eventName, playerId, payload, payload:len())
    end
end

---@type table<string, function>
local overwrites <const> = {
    --Notify
    notify = function(targetOrData, maybeData)
        if IS_SERVER then
            return module:Notify(targetOrData, maybeData)
        end

        module:Notify(targetOrData)
    end,
    --TextUI
    showTextUI = function(text, options)
        module:ShowTextUI(text, options)
    end,
    hideTextUI = function()
        module:HideTextUI()
    end,
    isTextUIOpen = function()
        return module:IsTextUIOpen()
    end,
    --Progressbar
    progressBar = function(data)
        return module:ProgressBar(data)
    end,
    progressCircle = function(data)
        data.variant = 'secondary'
        return module:ProgressBar(data)
    end,
    progressActive = function()
        return module:ProgressActive()
    end,
    cancelProgress = function()
        module:CancelProgress()
    end,
    --Radial
    addRadialItem = function(items)
        module:AddRadialItem(items)
    end,
    removeRadialItem = function(item)
        module:RemoveRadialItem(item)
    end,
    clearRadialItems = function()
        module:ClearRadialItems()
    end,
    registerRadial = function(radial)
        module:RegisterRadial(radial)
    end,
    hideRadial = function()
        module:HideRadial()
    end,
    disableRadial = function(state)
        module:DisableRadial(state)
    end,
    getCurrentRadialId = function()
        return module:GetCurrentRadialId()
    end,
    --Skillcheck
    skillCheck = function(difficulty, inputs, options)
        return module:SkillCheck(difficulty, inputs, options)
    end,
    skillCheckActive = function()
        return module:SkillCheckActive()
    end,
    cancelSkillCheck = function()
        return module:CancelSkillCheck()
    end,
    --InputDialog
    inputDialog = function(heading, rows, options)
        return module:InputDialog(heading, rows, options)
    end,
    closeInputDialog = function()
        module:CloseInputDialog()
    end,
    --ContextMenu
    registerContext = function(context)
        module:RegisterContext(context)
    end,
    showContext = function(id)
        module:ShowContext(id)
    end,
    hideContext = function(onExit)
        module:HideContext(onExit)
    end,
    getOpenContextMenu = function()
        return module:GetOpenContextMenu()
    end,
    --AlertDialog
    alertDialog = function(data)
        return module:AlertDialog(data)
    end,
    closeAlertDialog = function()
        module:CloseAlertDialog()
    end,
    --ListMenu
    registerMenu = function(data, cb)
        module:RegisterMenu(data, cb)
    end,
    showMenu = function(id)
        module:ShowMenu(id)
    end,
    hideMenu = function(onExit)
        module:HideMenu(onExit)
    end,
    getOpenMenu = function()
        return module:GetOpenMenu()
    end,
    setMenuOptions = function(id, options, index)
        module:SetMenuOptions(id, options, index)
    end
}

---@type table<string, string>
local functionComponentMap = {
    -- Notify
    notify = 'notify',

    -- TextUI
    showTextUI = 'textUI',
    hideTextUI = 'textUI',
    isTextUIOpen = 'textUI',

    -- Progressbar
    progressBar = 'progressBar',
    progressCircle = 'progressBar',
    progressActive = 'progressBar',
    cancelProgress = 'progressBar',

    -- Radial
    addRadialItem = 'radial',
    removeRadialItem = 'radial',
    clearRadialItems = 'radial',
    registerRadial = 'radial',
    hideRadial = 'radial',
    disableRadial = 'radial',
    getCurrentRadialId = 'radial',

    -- Skillcheck
    skillCheck = 'skillCheck',
    skillCheckActive = 'skillCheck',
    cancelSkillCheck = 'skillCheck',

    -- InputDialog
    inputDialog = 'inputDialog',
    closeInputDialog = 'inputDialog',

    -- ContextMenu
    registerContext = 'contextMenu',
    showContext = 'contextMenu',
    hideContext = 'contextMenu',
    getOpenContextMenu = 'contextMenu',

    -- AlertDialog
    alertDialog = 'alertDialog',
    closeAlertDialog = 'alertDialog',

    -- ListMenu
    registerMenu = 'listMenu',
    showMenu = 'listMenu',
    hideMenu = 'listMenu',
    getOpenMenu = 'listMenu',
    setMenuOptions = 'listMenu'
}

do
    local overrideCount = 0
    local totalCount = 0

    for key, newFunc in pairs(overwrites) do
        totalCount = totalCount + 1
        local component = functionComponentMap[key]

        if not component or not disabledComponents[component] then
            local success, err = pcall(function()
                lib[key] = newFunc
                overrideCount = overrideCount + 1
            end)
            if not success and debugMode then
                print(('[prism_uipack] Failed to override lib.%s: %s'):format(key, err))
            end
        elseif debugMode then
            print(('[prism_uipack] Skipped overriding lib.%s (component "%s" disabled)'):format(key, component))
        end
    end

    if debugMode then
        print(('[prism_uipack] Successfully initialized %d/%d function overrides'):format(
            overrideCount,
            totalCount
        ))
    end
end

local oExports = exports

exports = setmetatable({}, {
    __call = function(_, name, fn)
        return oExports(name, fn)
    end,
    __index = function(_, key)
        if key == 'ox_lib' then
            return setmetatable({}, {
                __index = function(_, funcName)
                    local fn = overwrites[funcName]
                    if fn then
                        return function(_, ...)
                            return fn(...)
                        end
                    end
                    return oExports['ox_lib'][funcName]
                end
            })
        end
        return oExports[key]
    end
})

--[[

  local DIRK_LIB <const> = "dirk_lib"
  if GetResourceState(DIRK_LIB) == "missing" then return end
   
  local success, err = pcall(function()
      local code = LoadResourceFile(DIRK_LIB, "src/oxOverwrite.lua")
      if code then
          load(code)()
      end
  end)
  
  if not success then
      error(("Failed to load dirk_lib. Error:"):format(err))
  end
]]