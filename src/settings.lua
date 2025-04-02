local autodetected = require 'src.autodetect'
return {
  primaryColor    = GetConvar('dirk_lib:primaryColor', 'dirk'),
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

  framework         = GetConvar('dirk_lib:framework', autodetected.framework),
  inventory         = GetConvar('dirk_lib:inventory', autodetected.inventory),
  itemImgPath       = GetConvar('dirk_lib:itemImgPath', autodetected.itemImgPath),
  target            = GetConvar('dirk_lib:target', autodetected.target),
  interact          = GetConvar('dirk_lib:interact', autodetected.interact),
  time              = GetConvar('dirk_lib:time', autodetected.time),
  phone             = GetConvar('dirk_lib:phone', autodetected.phone),

  keys            = GetConvar('dirk_lib:keys', autodetected.keys),
  garage          = GetConvar('dirk_lib:garage', autodetected.garage),
  fuel            = GetConvar('dirk_lib:fuel', autodetected.fuel),
  
  ambulance       = GetConvar('dirk_lib:ambulance', autodetected.ambulance),
  prison          = GetConvar('dirk_lib:prison', autodetected.prison),
  dispatch        = GetConvar('dirk_lib:dispatch', autodetected.dispatch),

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
  