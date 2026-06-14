local TGI = 'tgiann-inventory'
local cachedItems

-- tgiann splits operations between player inventories (number src) and
-- secondary inventories (stash/glovebox/trunk/etc, string id). All bridge
-- functions accept either; route based on invId type.
local function isStash(invId)
  return type(invId) ~= 'number'
end

local bridge = {

  --- Add Item to inventory either playerid or invId
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param md table [Optional] Item Metadata
  ---@param slot number [Optional] Item Slot
  ---@return boolean
  addItem = function(invId, item, count, md, slot)
    count = count or 1
    if isStash(invId) then
      return exports[TGI]:AddItemToSecondaryInventory('stash', invId, item, count, slot, md)
    end
    return exports[TGI]:AddItem(invId, item, count, slot, md)
  end,

  --- Remove Item from inventory either playerid or invId
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param md table [Optional] Item Metadata
  ---@param slot number [Optional] Item Slot
  ---@return boolean
  removeItem = function(invId, item, count, md, slot)
    count = count or 1
    if isStash(invId) then
      return exports[TGI]:RemoveItemFromSecondaryInventory('stash', invId, item, count, slot, md)
    end
    return exports[TGI]:RemoveItem(invId, item, count, slot, md)
  end,

  --- Check if player has item in inventory
  ---@param invId string | number Inventory ID or Player ID
  ---@param item string Item Name
  ---@param count number [Optional] Item Count
  ---@param md table [Optional] Item Metadata
  ---@param slot number [Optional] Item Slot
  ---@return number | boolean  Returns false if not present, count (number) when present
  hasItem = function(invId, item, count, md, slot)
    count = count or 1

    if isStash(invId) then
      local stashItem = exports[TGI]:GetItemByNameFromSecondaryInventory('stash', invId, item, md)
      if not stashItem then return false end
      local amount = stashItem.amount or stashItem.count or 0
      return amount >= count and amount or false
    end

    -- GetItem with returnsAmount=true sums every stack of `item` (with
    -- optional metadata filter) and returns the total.
    local amount = exports[TGI]:GetItem(invId, item, md, true)
    if not amount or amount == 0 then return false end

    if slot then
      local slotItem = exports[TGI]:GetItemBySlot(invId, slot, md)
      if not slotItem or slotItem.name ~= item then return false end
      local slotAmount = slotItem.amount or slotItem.count or 0
      return slotAmount >= count and slotAmount or false
    end

    return amount >= count and amount or false
  end,

  --- Slot-indexed snapshot of every item in the inventory.
  getItems = function(invId)
    if isStash(invId) then
      return exports[TGI]:GetSecondaryInventoryItems('stash', invId) or {}
    end
    return exports[TGI]:GetPlayerItems(invId) or {}
  end,

  --- Single slot lookup.
  getItemBySlot = function(invId, slot)
    if isStash(invId) then
      -- tgiann has no per-slot lookup for secondary inventories; walk the snapshot.
      local items = exports[TGI]:GetSecondaryInventoryItems('stash', invId) or {}
      for _, v in pairs(items) do
        if v.slot == slot then return v end
      end
      return nil
    end
    return exports[TGI]:GetItemBySlot(invId, slot)
  end,

  --- First matching slot for an item (optional metadata filter).
  getItemByName = function(invId, item, md)
    if isStash(invId) then
      return exports[TGI]:GetItemByNameFromSecondaryInventory('stash', invId, item, md)
    end
    return exports[TGI]:GetItemByName(invId, item, md)
  end,

  --- Same as getItemByName but with metadata required.
  getItemByMetadata = function(invId, item, md)
    return bridge.getItemByName(invId, item, md)
  end,

  --- Register a usable item.
  --- tgiann routes item-use through its own `usingItem` hook, which hands us
  --- the exact slot + metadata the player used. We deliver that to the consumer
  --- so the SERVER gets an authoritative { name, slot, metadata } — rather than
  --- trusting the framework's ESX.RegisterUsableItem callback (which tgiann
  --- leaves empty) or guessing the slot from a name lookup.
  --- NOTE: the item must be `useable = true` in its tgiann item definition for
  --- the hook to fire.
  ---@param itemName string
  ---@param cb fun(src: number, item: { name: string, slot: number, metadata: table, count: number })
  useableItem = function(itemName, cb)
    return exports[TGI]:registerHook('usingItem', function(payload)
      local item = payload.item or {}
      cb(payload.source, {
        name     = item.name or itemName,
        slot     = payload.slot,
        metadata = payload.metadata or item.metadata or item.info or {},
        count    = payload.amount or item.amount or item.count or 1,
      })
    end, { itemFilter = { [itemName] = true } })
  end,

  --- Set metadata of an item at a specific slot.
  setMetadata = function(invId, slot, metadata)
    if isStash(invId) then
      lib.print.warn('tgiann-inventory bridge: setMetadata on stash inventories is not supported')
      return false
    end
    local slotItem = exports[TGI]:GetItemBySlot(invId, slot)
    if not slotItem or not slotItem.name then return false end
    return exports[TGI]:UpdateItemMetadata(invId, slotItem.name, slot, metadata)
  end,

  --- editMetadata is the older name for setMetadata; alias.
  editMetadata = function(invId, slot, metadata)
    return bridge.setMetadata(invId, slot, metadata)
  end,

  --- Clear every item from the inventory.
  clearInventory = function(invId, filterItems)
    if isStash(invId) then
      -- Delete the secondary inventory entirely; tgiann recreates it on next access.
      return exports[TGI]:DeleteInventory('stash', invId)
    end
    return exports[TGI]:ClearInventory(invId, filterItems)
  end,

  --- Some consumers call lib.inventory.get; same shape as getItems.
  get = function(invId)
    return bridge.getItems(invId)
  end,

  --- Display name for an item id.
  getItemLabel = function(item)
    return exports[TGI]:GetItemLabel(item)
  end,

  --- Can the player carry `count` more of `item`?
  canCarryItem = function(invId, item, count)
    if isStash(invId) then return true end -- tgiann has no equivalent stash check
    return exports[TGI]:CanCarryItem(invId, item, count or 1)
  end,

  --- Register a stash. tgiann supports two signatures — positional is the
  --- one mirrored in their docs.
  registerStash = function(id, data)
    return exports[TGI]:RegisterStash(
      id,
      data.label,
      data.maxSlots,
      data.maxWeight,
      data.owner,
      data.groups,
      data.coords
    )
  end,

  --- Single-item lookup, returns the normalised record (matching `items()`
  --- shape) or nil if the item isn't registered.
  ---@param name string
  ---@return { name: string, label: string, weight: number, image: string }?
  item = function(name)
    if type(name) ~= 'string' or name == '' then return nil end
    local raw = exports[TGI]:Items(name)
    if not raw then return nil end
    return {
      name   = raw.name or name,
      label  = raw.label or raw.name or name,
      weight = raw.weight or 0,
      image  = lib.formatImagePath(raw.image or raw.name or name),
    }
  end,

  --- All registered items, keyed by name. Cached; invalidated whenever
  --- branding.itemImgPath changes so an admin CDN URL set via /dirk_config
  --- doesn't get masked by URLs baked from the boot-time autodetect default.
  ---@return table<string, { name: string, label: string, weight: number, image: string }>
  items = function()
    if cachedItems then return cachedItems end
    local all = exports[TGI]:Items()
    if not all then return {} end
    local out = {}
    for k, v in pairs(all) do
      out[k] = {
        name   = v.name or k,
        label  = v.label or v.name or k,
        weight = v.weight or 0,
        image  = lib.formatImagePath(v.image or v.name or k),
      }
    end
    cachedItems = out
    return out
  end,
}

if lib.onSettings then
  lib.onSettings('itemImgPath', function() cachedItems = nil end)
end

return bridge
