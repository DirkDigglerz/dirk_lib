---@class GroupProps
---@field id string
---@field name string
---@field owner string
---@field members GroupMemberProps[]
---@field task nil | TaskProps
---@field metadata table<string, any> | nil
---@field invites string[]

---@class TaskProps
---@field id string
---@field label string

local Groups = {}
Group  = {}
Group.__index = Group

---@function Group.generateId
---@description Generates a unique group identifier
---@return string
Group.generateId = function()
  local id = ('group_%s'):format(math.random(1000, 9999))
  if Groups[id] then 
    Wait(0)
    return Group.generateId()
  end
  return id
end

function Group:__init()
  if not self.owner then return false, 'owner_not_set' end
  local ownerId = lib.player.checkOnline(self.owner)
  if not ownerId then return false, 'owner_not_online' end
  local playerGroup = Group.getGroupById(self.owner)
  if playerGroup then return false, 'player_already_in_group' end

  if not self.name then return false, 'name_not_set' end
  self.members = {}
  self.invites = {}
  local firstName, lastName = lib.player.name(tonumber(ownerId))
  self:addMember({
    id       = self.owner,
    role     = 'owner',
    metadata = {}, 
    name     = ('%s %s'):format(firstName, lastName),
    src      = ownerId,
  })

  return true
end


---@function lib.registerGroup
---@description Registers a group
---@param data GroupProps
---@return Group | false, string
lib.registerGroup = Group.register

Group.register = function(data --[[ GroupProps ]])
  local self = setmetatable(data, Group)
  self.id    = Group.generateId()
  local can_create, reason = self:__init()
  if not can_create then 
    return false, reason
  end
  Groups[self.id] = self
  return self 
end 

lib.callback.register('dirk_groups:registerGroup', function(src, data)
  local ownerId = lib.player.identifier(src)
  if not ownerId then return false, 'invalid_owner' end
  data.owner = ownerId
  local newGroup, reason = Group.register(data)
  
  return newGroup and newGroup.id or false, reason
end)

--- Cheap "any groups at all?" probe. Lets hot per-player-load paths (see
--- member.lua's dirk_groups:playerLoaded) bail before doing identifier
--- lookups when no group exists — `Groups` is file-local, so this is the
--- only sanctioned way to ask from outside this file.
Group.hasAny = function()
  return next(Groups) ~= nil
end

---@function Group.getGroupById || lib.getGroupById
---@description Gets a group by the owner's identifier
---@param memberId string | number
---@return Group | false, string
Group.getGroupById = function(memberId)
  for k,v in pairs(Groups) do
    for _, member in pairs(v.members) do
      if member.id == memberId or (member.src and tonumber(member.src) == tonumber(memberId)) then
        return v
      end
    end
  end
  return false, 'group_not_found'
end

lib.getGroupById = Group.getGroupById

---@function Group.get
---@description Gets a group by its identifier
---@param id string
---@return Group | nil
Group.get = function(id)
  return Groups[id]
end

---@function lib.getGroup
---@description Gets a group by its identifier
---@param id string
---@return Group | nil
lib.getGroup = Group.get



---@function Group.getAll
---@description Gets all groups
---@return table<string, Group>
Group.getAll = function()
  return Groups
end

---@function lib.getAllGroups
---@description Gets all groups
---@return table<string, Group>
lib.getAllGroups = Group.getAll

---@function Group.destroy
---@description Destroys a group by its identifier
---@param id string
Group.destroy = function(id)
  local group = Group.get(id)
  if not group then return end
  for _, member in pairs(group.members) do
    if member.src then
      if group.task then
        TriggerClientEvent('dirk_groups:endTask', member.src, group.task.id)
      end
      -- TriggerClientEvent('dirk_groups:updateGroup', member.src)
      Player(member.src).state.group = nil
    end 
  end
  Groups[id] = nil
end

AddEventHandler('onResourceStop', function(resource)
  if resource == GetCurrentResourceName() then
    for k,v in pairs(Groups) do
      Group.destroy(v.id)
    end 
  end
end)

---@function lib.destroyGroup
---@description Destroys a group by its identifier
---@param id string
lib.destroyGroup = Group.destroy

lib.callback.register('dirk_groups:disbandGroup', function(src)
  local player = lib.player.identifier(src)
  local group = Group.getGroupById(player)
  if not group then return false, 'group_not_found' end
  if group.owner ~= player then return false, 'not_owner' end
  if group.task then return false, 'group_has_task' end
  Group.destroy(group.id)
  return true
end)

lib.callback.register('dirk_groups:getNearbyPlayers', function(src)
  local myGroup = Group.getGroupById(src)
  local groups = lib.settings.groups
  local players = GetPlayers()
  local nearby = {}
  local myPed = GetPlayerPed(src)
  local myPos = GetEntityCoords(myPed)
  for _, player in ipairs(players) do
    if tonumber(player) ~= tonumber(src) then
      local inGroup = Group.getGroupById(tonumber(player))
      local ped = GetPlayerPed(player)
      local pos = GetEntityCoords(ped)
      local distance = #(myPos - pos)
      if distance <= groups.maxDistanceInvite then
        table.insert(nearby, {
          id           = player,
          name         = lib.player.name(tonumber(player)),
          distance     = distance,
          inMyGroup    = inGroup?.id == myGroup.id,
          inOtherGroup = inGroup and inGroup.id ~= myGroup.id
        })
      end
    end
  end
  return nearby
end)

---@function lib.groupEvent
---@description Triggers an event for all members of a group
---@param groupId string
---@param eventName string
---@vararg any
lib.groupEvent = function(groupId, eventName, ...)
  local group = Group.get(groupId)
  if not group then return end
  for _, member in pairs(group.members) do
    if member.src then
      TriggerClientEvent(eventName, member.src, ...)
    end
  end
end