local paymentMethods = require 'src.stores.paymentMethods'

function Store:openStore(src)
  local canOpen = self.canOpen and self.canOpen(src) or true
  if not canOpen then return false, 'cannot_open_custom' end

  if self.location then 
    local playerCoords = GetEntityCoords(GetPlayerPed(src))
    if type(self.location) == 'table' then 
      local distance = #(playerCoords - vector3(self.location.x, self.location.y, self.location.z))
      if distance > self.location.radius then 
        return false, 'not_in_store'
      end
    else 
      local distance = #(playerCoords - vector3(self.location.x, self.location.y, self.location.z))
      if distance > 5.0 then 
        return false, 'not_in_store'
      end
    end
  end

  self.usingStore[src] = true
  local thisPaymentMethods = {}
  for k,v in pairs(self.paymentMethods) do
    table.insert(thisPaymentMethods, {
      id   = v,
      name = paymentMethods[v].name,
      icon = paymentMethods[v].icon,
    })
  end

  local stock = {}
  for k,v in ipairs(self.stock) do
    local default_data = {
      listing_id = v.listing_id,
      name       = v.name,
      price      = v.price,
      icon       = v.icon,
      category   = v.category,
      label      = v.label,
      image      = v.image,
      description = v.description,
      stock      = self.type == 'sell' and (lib.inventory.hasItem(src, v.name) or 0) or v.stock,
    }

    if self.type == 'sell' then 
      

      local has_item = lib.inventory.hasItem(src, v.name)
      if has_item and has_item > 0 then 
        default_data.stock = has_item
      else 
        default_data.disableIcon = 'fas fa-ban'
        default_data.disableMessage = locale('dont_have_item')
      end
    else 
      if v.stock and v.stock <= 0 then 
        default_data.disableIcon = 'fas fa-ban'
        default_data.disableMessage = locale('out_of_stock')    
      end 
    end 
    table.insert(stock, default_data)
  end

  return true, {
    storeInfo = {
      name           = self.name,
      description    = self.description,
      icon           = self.icon,
      type           = self.type,
      currency       = self.currency or lib.settings.currency,
      hasCategories  = self.categories and #self.categories > 0,
      paymentMethods = thisPaymentMethods,
    },

    items = stock,
    categories = self.categories,
  }
end


lib.callback.register('dirk_stores:openStore', function(src, store_id)
  local store = Store.get(store_id)
  if not store then return false, 'store_not_found' end
  return store:openStore(src)
end)

function Store:closedStore(src)
  self.usingStore[src] = nil
end

RegisterNetEvent('dirk_stores:closeStore', function(store_id)
  local store = Store.get(store_id)
  if not store then return end
  store:closedStore(source)
end)