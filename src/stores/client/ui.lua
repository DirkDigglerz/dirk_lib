lib.openStore = function(storeId)
  local can_open, uiData = lib.callback.await('dirk_stores:openStore', storeId)
  if not can_open then 
    return lib.print.debug(('Store %s cannot be opened reason: %s'):format(storeId, uiData))
  end
  openStoreId = storeId
  SendNUIMessage({
    action = 'OPEN_STORE',
    data   = uiData
  })
  TriggerScreenblurFadeIn(500)
  SetNuiFocus(true, true)
end


lib.closeStore = function()
  while IsScreenblurFadeRunning() do Wait(0) end
  TriggerScreenblurFadeOut(0)
  if not openStoreId then return end
  SetNuiFocus(false, false)
  SendNUIMessage({
    action = 'CLOSE_STORE'
  })
  TriggerServerEvent('dirk_stores:closeStore', openStoreId)
  openStoreId = nil
end

RegisterNuiCallback('MAKE_TRANSACTION', function(data, cb)
  local transaction, failMessage = lib.callback.await('dirk_stores:attemptTransaction', openStoreId, data.cart, data.method)
  lib.print.info(('Response from transaction: %s, %s'):format(transaction, failMessage))
  if transaction then 
    lib.closeStore();
  end
  cb({transaction = transaction, failMessage = failMessage})
end)

RegisterNuiCallback('STORE_CLOSED', function(data, cb)
  lib.closeStore()
end)

AddEventHandler('onResourceStop', function(resource)
  if resource == GetCurrentResourceName() then 
    if cache.game == 'fivem' then 
      TriggerScreenblurFadeOut(500)
    end 
  end
end)

RegisterCommand('test_store', function()
  lib.openStore('store_test')
end)