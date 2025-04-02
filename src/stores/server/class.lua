local paymentMethods = require 'src.stores.paymentMethods'
local Stores = {}

Store = {}
Store.__index = Store

function Store:generateListingId()
  local id = string.format('%s_%s', self.id, math.random(1000, 9999))
  Wait(0)
  for k,v in pairs(self.stock) do
    if v.listing_id == id then
      return self:generateListingId()
    end
  end
  return id
end

local function getItemLabel(name)
  return name:gsub('_', ' '):gsub('(%l)(%w*)', function(a,b) return string.upper(a)..b end)
end

local function getItemImage(name)
  return string.format('%s%s.png', lib.settings.item_img_path, name)
end

function Store:sanitizeItems()
  for k,v in ipairs(self.stock) do
    self.stock[k].listing_id = self:generateListingId()
    assert(v.name, 'Item must have a name')
    assert(v.price, 'Item must have a price')
    assert(v.category, 'Item must have a category')
    self.stock[k].label = v.label or lib.inventory.getItemLabel(v.name) or getItemLabel(v.name)
    self.stock[k].image = v.image or getItemImage(v.name) 
    self.stock[k].description = v.description or ''
  end
  return true
end

function Store:__init()
  self.type = self.type or 'buy'
  assert(self.name, 'Store must have a name')
  assert(self.description, 'Store must have a description')
  assert(self.icon, 'Store must have an icon')


  assert(self.paymentMethods, 'Store must have payment methods')
  for k,v in pairs(self.paymentMethods) do
    assert(paymentMethods[v], ('Payment %s method does not exist in settings/paymentMethods'):format(v))
  end

  assert(self.categories and type(self.categories) == 'table', 'Store categories must exist and be an array of categories')
  for k,v in pairs(self.categories) do
    assert(v.name, 'Category must have a name')
    assert(v.icon, 'Category must have an icon')
    assert(v.description, 'Category must have a description')
  end

  assert(self.stock and type(self.stock) == 'table', 'Store items must exist and be an array of items')
  local passed_items = self:sanitizeItems()
  if not passed_items then return false end

  return true 
end

Store.register = function(id, data)
  local self = setmetatable(data, Store)
  self.id = id
  self.resource = GetInvokingResource() or GetCurrentResourceName()
  self.usingStore = {}
  if self:__init() then 
    Stores[id] = self
    return self
  else 
    return nil
  end
end

lib.registerStore = Store.register

Store.destroy = function(id)
  local store = Stores[id]
  if not store then return end
  Stores[id] = nil
end

lib.destroyStore = Store.destroy

Store.get = function(id)
  return Stores[id]
end

lib.getStore = Store.get

AddEventHandler('onResourceStop', function(resource)
  for k,v in pairs(Stores) do
    if v.resource == resource then
      Stores[k] = nil
    end
  end
end)

AddEventHandler('playerDropped', function()
  local src = source
  for k,v in pairs(Stores) do
    v.usingStore[src] = nil
  end
end)

--[[
  Server Sided Usage: 
]]


