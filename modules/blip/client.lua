local blips = {}
local blip = {}
blip.__index = blip

blip.new = function(id, data)
  local self = setmetatable(data, blip)
  self.id = id
  self:__init()
  blips[id] = self
  return self
end

blip.get = function(id)
  return blips[id]
end

blip.delete = function(id)
  local blip = blips[id]
  if blip then
    blip:hide()
  end
  blips[id] = nil
end

blip.update = function(id, data)
  local foundBlip = blips[id]
  if foundBlip then
    for k,v in pairs(data) do 
      foundBlip[k] = v
    end
    blip:hide()
    blip:render()
  end
end


function blip:__init()
  assert(self.pos, 'blip must have a position')
  assert(self.name, 'blip must have a name')
  assert(self.sprite, 'blip must have a sprite')
  assert(self.display, 'blip must have a display')
  assert(self.scale, 'blip must have a scale')
  assert(self.color, 'blip must have a color')

  assert(not self.area or self.area?.width, 'blip area must have a width')
  assert(not self.area or self.area?.height, 'blip area must have a height')

  assert(not self.radius or type(self.radius) == 'number', 'blip radius must be a number')

  assert(not self.entity or type(self.entity) == 'number', 'blip entity must be a number')
  self:render()
end

function blip:canRender()
  return ((self.canSee and self.canSee()) ~= nil) or true
end


function blip:render()
  if self.blip then return end
  if not self:canRender() then return end
  local blip
  if self.area then
    blip = AddBlipForArea(self.pos.x, self.pos.y, self.pos.z, self.area.width, self.area.height)
  elseif self.radius then
    blip = AddBlipForRadius(self.pos.x, self.pos.y, self.pos.z, self.radius)
  elseif self.entity then
    blip = AddBlipForEntity(self.entity)
  else
    blip = AddBlipForCoord(self.pos.x, self.pos.y, self.pos.z)
  end

  if not self.radius then 
    SetBlipSprite(blip, self.sprite or 1)
    SetBlipScale(blip, self.scale or 1.0)
  end 

  if cache.game == 'fivem' then 
    SetBlipDisplay(blip, self.display or 4)
    SetBlipColour(blip, self.color or 1)
    SetBlipAsShortRange(blip, self.shortRange ~= nil and self.shortRange or true)
    SetBlipCategory(blip, self.category or 1)
    SetBlipAlpha(blip, self.alpha or 255)
  end 
  
  if self.rotation then SetBlipRotation(blip, self.rotation or 0) end

  if self.route then
    SetBlipRoute(blip, self.route or true)
  end
  
  if cache.game == 'redm' then 
    Citizen.InvokeNative(0x9CB1A1623062F402 , blip, self.name or 'Blip')
  elseif cache.game == 'fivem' then
    AddTextEntry(self.id, self.name or 'Blip')
    BeginTextCommandSetBlipName(self.id)
    EndTextCommandSetBlipName(blip)
  end

  AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() or resource == 'dirk_lib' then 
      self:hide()
    end
  end)

  self.blip = blip
end

function blip:hide()
  if not self.blip then return end
  RemoveBlip(self.blip)
  self.blip = nil
end


CreateThread(function()
  while true do
    local wait_time = 1000
    for k,v in pairs(blips) do
      if v.canSee then
        if v:canRender() then
          v:render()
        else
          v:hide()
        end
      end
    end


    Wait(wait_time)
  end
end)




lib.blip = {
  register = function(id, data)
    if blips[id] then
      lib.print.error(('blip %s already exists'):format(id))
      return
    end
    return blip.new(id, data)
  end,

  destroy = function(id)
    return blip.delete(id)
  end,

  get = function(id)
    return blip.get(id)
  end,

  update = function(id, data)
    return blip.update(id, data)
  end
}

return lib.blip

