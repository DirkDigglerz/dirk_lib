--[[
  Goal of this Discord Module:
  - Server will provide guild(s) ids that this interface will work with.
  - As players join we get their discord ID 
  - We then fetch and cache their roles, discord avatar, name etc etc 
  - Then I will have helper functions to fetch these things from my other scripts. 

    -- Functions:
    - getDiscordId(playerId)
    - getDiscordInfo(playerId) -- Returns a table with discord info like roles, avatar, name etc
    - getDiscordRoles(playerId) -- Returns a table with roles
    - getDiscordAvatar(playerId) -- Returns the avatar URL
    - getDiscordName(playerId) -- Returns the name

]]