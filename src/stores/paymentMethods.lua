return {
  ['cash'] = {
    name = 'Cash',
    icon = 'user',

    add = function(player, amount)
      --// Implement your own bank system here
      local cash_account = lib.settings.framework == 'qbx_core' or lib.settings.framework == 'qb-core' and 'cash' or 'money'
      return lib.player.addMoney(player, cash_account, amount)
    end,

    remove = function(player, amount)
      --// Implement your own bank system here
      local cash_account = lib.settings.framework == 'qbx_core' or lib.settings.framework == 'qb-core' and 'cash' or 'money'
      return lib.player.removeMoney(player, cash_account, amount)
    end
  },
  ['bank'] = {
    name = 'Card',
    icon = 'user',

    add = function(player, amount)
      --// Implement your own bank system here
      return lib.player.addMoney(player, 'bank', amount)
    end,

    remove = function(player, amount)
      --// Implement your own bank system here
      return lib.player.removeMoney(player, 'bank', amount)
    end
  },


  -- ['example_item_as_cash'] = {
  --   name = 'Card',
  --   icon = 'user',

  --   add = function(player, amount)
  --     --// Implement your own bank system here
  --     return lib.inventory.addItem(player, 'test_item', amount)
  --   end,

  --   remove = function(player, amount)
  --     --// Implement your own bank system here
--     return lib.inventory.removeItem(player, 'test_item', amount)
  --   end
  -- },
  
}