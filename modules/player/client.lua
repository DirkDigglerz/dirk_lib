local settings      = lib.settings
local bridge        = lib.loadBridge('framework', settings.framework, 'client')
local clothingBridge = lib.loadBridge('clothing', settings.clothing, 'client')

lib.player = {
  ---@function lib.player.identifier
  ---@description # Get the identifier of a player
  ---@return string
  identifier    = bridge.identifier,

  ---@function lib.player.name 
  ---@description # Get the name of a player
  ---@return string
  name          = bridge.name,

  ---@function lib.player.getPlayerData
  ---@description # Get the data of a player
  ---@param key? string
  ---@return table
  getPlayerData = bridge.getPlayerData,

  ---@function lib.player.getMetadata
  ---@description # Get the metadata of a player
  ---@param key? string  
  ---@return table
  getMetadata   = bridge.getMetadata,
  
  ---@function lib.player.getMoney 
  ---@description # Get the money of a player
  ---@param account string
  ---@return number
  getMoney      = bridge.getMoney,

  ---@function lib.player.getJob
  ---@description # Get the job of a player
  ---@return {name: string, type: string, label: string, grade: number, isBoss: boolean, bankAuth: boolean, gradeLabel: string, duty: boolean}
  getJob        = bridge.getJob,

  ---@function lib.player.getGang 
  ---@description # Get the gang of a player 
  ---@return {name: string, type: string, label: string, grade: number, isBoss: boolean, bankAuth: boolean, gradeLabel: string, duty: boolean}
  getGang        = bridge.getGang,
  ---@function lib.player.editStatus
  ---@description # Add to the status of a player, you can use negative values to remove status
  ---@param status string
  editStatus    = bridge.editStatus,

  ---@function lib.player.getItems
  ---@description # Get the items of a player
  ---@return table
  getItems      = bridge.getItems,

  ---@function lib.player.hasLicense
  ---@description # Checks if a player has a specific license
  ---@param license string | table
  getLicenses = bridge.getLicenses,

  ---@function lib.player.hasLicense
  ---@description # Checks if a player has a specific license
  ---@param param string | table
  ---@return boolean
  hasLicense = bridge.hasLicense,

  ---@function lib.player.hasGroup
  ---@description # Check if a player has a specific group
  ---@param group string | Record<string, number> | Array<string>
  ---@return boolean
  hasGroup = bridge.hasGroup,

  setSkin = clothingBridge.setSkin,
  openCustomisation = function()
    print('Opening clothing customisation')
    clothingBridge.openCustomisation()
  end,
}

return lib.player
