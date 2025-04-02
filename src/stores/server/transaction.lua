local paymentMethods = require 'src.stores.paymentMethods'
-- local metadataGenerators = require 'src.metadataGenerators'


function Store:attemptTransaction(src, cart, payment_method)
  local totalPrice = 0
  for k,v in pairs(cart) do
    local item = self:getItemByListingId(v.listing_id)
    
    if not item then 
      return false, 'no_item_by_id'
    end

    if item.stock and v.amount > item.stock then
      return false, 'not_enough_stock'
    end

    if self.type == 'sell' and not lib.inventory.hasItem(src, item.name, v.amount) then
      return false, 'not_enough_item'
    end

    totalPrice += item.price * v.amount 
  end


  if self.canExchange then 
    local canExchange, reason = self.canExchange(src, cart, totalPrice)
    if not canExchange then
      return false, reason
    end
  end
  
  --## Payment method
  local paymentMethod = paymentMethods[payment_method]
  if not paymentMethod then
    return false, 'invalid_payment_method'
  end

  if self.type == 'sell' then 
    lib.print.info(('Attempting to sell %s items for %s'):format(#cart, totalPrice))
    --## Remove all items and add money
    for k,v in pairs(cart) do
      local item = self:getItemByListingId(v.listing_id)
      if not lib.inventory.removeItem(src, item.name, v.amount) then 
        return false, 'remove_item_failed'
      end
    end
    paymentMethod.add(src, totalPrice)
  elseif self.type == 'buy' then 
    local removed, reason = paymentMethod.remove(src, totalPrice)
    if not removed then
      return false, 'payment_failed_no_money'
    end
  end   



  for k,v in pairs(cart) do
    self:updateStockByListingId(v.listing_id, -v.amount)
  end

  if self.onTransaction then
    self.onTransaction(src, cart, totalPrice)
  end

  for k,v in pairs(cart) do
    local item = self:getItemByListingId(v.listing_id)
    if self.type == 'sell' then 
      lib.inventory.removeItem(src, item.name, v.amount)
    else 
      -- local metadataGenerator = metadataGenerators[item.name]
      -- metadataGenerator and metadataGenerator() or 
      lib.inventory.addItem(src, item.name, v.amount, nil)
    end
  end

  lib.notify(src, {
    title = locale('transaction_complete'),
    description = locale('transaction_complete_message'),
    type = 'success',
  })

  return true
end

lib.callback.register('dirk_stores:attemptTransaction', function(src, store_id, cart, payment_method)
  local src = source
  local store = Store.get(store_id)
  if not store then return end
  return store:attemptTransaction(src, cart, payment_method)
end)