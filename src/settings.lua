local autodetected = require 'src.autodetect'

local settings = {
  primaryColor    = GetConvar('dirk_lib:primaryColor', GetGameName() == 'fivem' and 'dirk' or 'red'),
  primaryShade    = GetConvarInt('dirk_lib:primaryShade', 9),
  customTheme     = json.decode(GetConvar('dirk_lib:customTheme', json.encode({
    "#f8edff",
    "#e9d9f6",
    "#d0b2e8",
    "#b588da",
    "#9e65cf",
    "#914ec8",
    "#8a43c6",
    "#7734af",
    "#692d9d",
    "#5c258b"
  }))),
  debug           = GetConvar('dirk_lib:debug', 'true') == 'true',
  currency        = GetConvar('dirk_lib:currency', '$'),
  language        = GetConvar('dirk_lib:language', 'en'),
  primaryIdentifier = GetConvar('dirk_lib:primaryIdentifier', 'license'),
  serverName      = GetConvar('dirk_lib:serverName', 'DirkRP'),
  logo              = GetConvar('dirk_lib:logo', 'https://via.placeholder.com/150'),
  itemImgPath      = GetConvar('dirk_lib:itemImgPath', 'nui://dirk_inventory/web/images/'),

  --## Menus/Progress etc  
  notify          = GetConvar('dirk_lib:notify', 'dirk_lib'),
  notifyPosition  = GetConvar('dirk_lib:notifyPosition', 'top-right'),
  notifyAudio     = GetConvar('dirk_lib:notifyAudio', 'true') == 'true',

  progress        = GetConvar('dirk_lib:progress', 'dirk_lib'),
  progBarPosition = GetConvar('dirk_lib:progBarPosition', 'bottom-center'),

  showTextUI       = GetConvar('dirk_lib:showTextUI', 'dirk_lib'),
  showTextPosition = GetConvar('dirk_lib:showTextPosition', 'bottom-center'),
  
  contextMenu        = GetConvar('dirk_lib:contextMenu', 'dirk_lib'),
  contextClickSounds = GetConvar('dirk_lib:contextClickSounds', 'true') == 'true',
  contextHoverSounds = GetConvar('dirk_lib:contextHoverSounds', 'true') == 'true',

  dialog            = GetConvar('dirk_lib:dialog', 'dirk_lib'),
  dialogClickSounds = GetConvar('dirk_lib:dialogClickSounds', 'true') == 'true',
  dialogHoverSounds = GetConvar('dirk_lib:dialogHoverSounds', 'true') == 'true',
  
  -- GROUPS 
  groups = {
    maxMembers        = GetConvarInt('dirk_groups:maxMembers', 5),
    maxDistanceInvite = GetConvarInt('dirk_groups:maxDistanceInvite', 5),
    inviteValidTime   = GetConvarInt('dirk_groups:inviteValidTime', 5), -- minutes
    maxLogOffTime     = GetConvarInt('dirk_groups:maxLogOffTime', 5), -- minutes before you are autokicked for being offline
  },
}


---@todo add implementation for renamed resources 
-- local renamed = json.decode(GetConvar('dirk_lib:renamedResources', json.encode({})))

for system,resource in pairs(autodetected) do 
  settings[system] = GetConvar(('dirk_lib:%s'):format(system), resource)
end

return settings
