local settings      = lib.settings
local bridge        = lib.loadBridge('player', settings.framework, 'client')

lib.player = {
  ---@function lib.player.identifier
  ---@description # Get the identifier of a player
  ---@return string
  identifier    = bridge.identifier,

  ---@function lib.player.name 
  ---@description # Get the name of a player
  ---@return string
  name          = bridge.name,

  ---@function lib.player.getInventory
  ---@description # Get the inventory of a player
  ---@return table
  getInventory  = bridge.getInventory,

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

  ---@function lib.player.isDead 
  ---@description # Check if a player is dead
  ---@return boolean
  isDead        = bridge.isDead,

  ---@function lib.player.isCuffed
  ---@description # Check if a player is handcuffed
  ---@return boolean
  isCuffed      = bridge.isCuffed

  setPlayerStatus = function(status, value)
    local playerState = LocalPlayer.state
    for name, value in pairs(values) do
      if value > 100 or value < -100 then
        value = value * 0.0001
      end
      playerState:set(name, playerState[name] + value, true)
    end
  end, 
}

return lib.player
