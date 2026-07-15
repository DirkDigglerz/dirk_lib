local groups = lib.settings.groups
---@class GroupMemberProps
---@field id string
---@field role string
---@field name string
---@field metadata table<string, any> | nil
---@field src number


---@function addGroupMember
---@description Adds a member to a group
---@param groupId string
---@param member GroupMemberProps
lib.addGroupMember = function(groupId, member)
  local group = Group.get(groupId)
  if not group then return end
  group:addMember(member)
end

function Group:addMember(member)
  self.members[#self.members + 1] = member
  self:updateClients()
end

---@function removeGroupMember
---@description Removes a member from a group
---@param groupId string
---@param member {id?: string, src?: number} 
lib.removeGroupMember =  function(groupId, member)
  local group = Group.get(groupId)
  if not group then return end
  group:removeMember(member)
end

function Group:removeMember(member)
  if self.task then return false, 'group_has_task' end
  for k,v in pairs(self.members) do
    if v.id == member.id or (v.src and tonumber(v.src) == tonumber(member.src)) then
      table.remove(self.members, k)
      if v.src then
        -- TriggerClientEvent('dirk_groups:updateGroup', tonumber(v.src))
        Player(v.src).state.group = nil
      end 
      self:updateClients()
      return true
    end
  end
  return false
end

---@function editMemberMetadata
---@description Edits a member's metadata
---@param groupId string
---@param member {id?: string, src?: number}
---@param metadata table<string, any>
lib.editMemberMetadata =  function(groupId, member, metadata)
  local group = Group.get(groupId)
  if not group then return end
  group:editMemberMetadata(member, metadata)
end

function Group:editMemberMetadata(member, metadata)
  local member = self.members[member.id]
  if not member then return false, 'Member not found' end
  local metadata = member.metadata
  for k,v in pairs(metadata) do
    metadata[k] = v
  end
  self:updateClients()
end



---@function getGroupMembers
---@description Returns a list of members in a group
---@param groupId string
---@return table<string, any>[]
lib.getGroupMembers =  function(groupId)
  local group = Group.get(groupId)
  if not group then return end
  return group.members
end



function Group:loggedOn(src)
  local id = lib.player.identifier(src)
  -- set their offline status to nil and update clients
  for k,v in pairs(self.members) do
    if v.id == id then
      v.offline = nil
      v.src     = src
      if v.logoutTimer then
        ClearTimeout(v.logoutTimer)
        v.logoutTimer = nil
      end
      self:updateClients()

      if self.task then 
        TriggerClientEvent('dirk_groups:startTask', v.src, self.task.id, self.task.args)
      end 
      return
    end
  end
end

function Group:__leave(src)
  self:removeMember({src = src})
  return true 
end

lib.callback.register('dirk_groups:leaveGroup', function(src)
  local group = Group.getGroupById(src)
  if not group then return false, 'group_not_found' end
  return group:__leave(src)
end)


function Group:loggedOff(src)
  -- set their offline status to os.time and update clients
  for k,v in pairs(self.members) do
    if tonumber(v.src) == tonumber(src) then
      local now = os.time()
      v.offline = now
      v.src     = nil
      self:updateClients()
      v.logoutTimer = SetTimeout(groups.maxLogOffTime * 60000, function()
        if v.offline and v.offline == now then
          self:removeMember(v)
        end
      end)
      return
    end
  end
end

AddEventHandler('playerDropped', function(reason)
  local src = source
  local group = Group.getGroupById(src)
  if not group then return end
  group:loggedOff(src)
end)


lib.callback.register('dirk_groups:playerLoaded', function(src)
  -- Fires on EVERY character load. With no active groups (the common case)
  -- there is nothing to reconnect — bail before lib.player.identifier(), whose
  -- cross-resource lookup can stall while the joining player's framework
  -- object is still settling. Profiled at up to 716ms per join on a 350-slot
  -- server (reported by reyesmtv); this early-out makes the idle path free.
  if not Group.hasAny() then return false end

  local identifier = lib.player.identifier(src)
  if not identifier then return false end
  local group = Group.getGroupById(identifier)
  if group then
    group:loggedOn(src)
    Player(src).state.group = group:getClientData()
  end
  return false
end)

lib.callback.register('dirk_groups:kickPlayer', function(src, target)
  local group = Group.getGroupById(src)
  if not group then return false, 'group_not_found' end
  if group.owner ~= lib.player.identifier(src) then return false, 'not_owner' end
  if group.task then return false, 'group_has_task' end
  return group:removeMember({id = target})
end)
