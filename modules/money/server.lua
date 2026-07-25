--============================================================
-- MONEY
--
-- One money-changed event, whatever the framework underneath.
--
-- Every framework announces balance changes differently, and the differences
-- are the kind that bite quietly:
--
--   es_extended  three separate events, one per operation
--                esx:addAccountMoney / removeAccountMoney  -> DELTA
--                esx:setAccountMoney                       -> NEW TOTAL
--                (source, account, money, reason)
--
--   qb-core      one event, and qbx_core reuses the same NAME rather than
--   qbx_core     having its own, so a single handler covers both
--                QBCore:Server:OnMoneyChange
--                (source, moneyType, amount, action, reason)
--                action 'add'/'remove' -> DELTA, action 'set' -> NEW TOTAL
--
--   ND_Core      ND:moneyChange
--                (source, account, amount, action, reason)
--                same delta/total split, and `reason` may be nil
--
-- So "amount" means two different things depending on the action, on all four.
-- Rather than make every consumer remember that, this module resolves the real
-- balance after each change and reports BOTH: the signed delta and the new
-- total. A consumer never has to know which framework it is on.
--============================================================

local settings = require 'src.settings'

local money = {}

--- Registered listeners.
local handlers = {}

--- Last balance we saw, per `source:account`. Used to turn a "set" into a
--- delta, and to correct a delta the framework reported against a balance that
--- something else had already changed.
local lastKnown = {}

local function key(src, account) return ('%s:%s'):format(src, account) end

--- Read the balance the framework actually holds right now.
--- Deliberately AFTER the event: several frameworks fire before their own
--- bookkeeping settles, and the authoritative number is the one on the player.
local function currentBalance(src, account)
    local ok, balance = pcall(function() return lib.player.getMoney(src, account) end)
    if ok and type(balance) == 'number' then return balance end
    return nil
end

--- Announce a change to everyone listening.
--- @param src number
--- @param account string
--- @param action 'add'|'remove'|'set'
--- @param reported number the number the framework gave us
--- @param reason string|nil
local function emit(src, account, action, reported, reason)
    if not src or not account then return end
    reported = tonumber(reported) or 0

    local slot = key(src, account)
    local previous = lastKnown[slot]
    local total = currentBalance(src, account)

    -- Work out the signed delta. Preferring the real balances over the
    -- framework's number means we stay correct even when it reports a total as
    -- though it were a delta, which 'set' does everywhere.
    local delta
    if total and previous then
        delta = total - previous
    elseif action == 'add' then
        delta = reported
    elseif action == 'remove' then
        delta = -reported
    end

    if total then lastKnown[slot] = total end

    -- A 'set' that changed nothing is noise, and so is an add/remove of zero.
    if delta == 0 then return end

    local payload = {
        source = src,
        account = account,
        action = action,
        --- Signed: positive in, negative out. Nil only when we could not read a
        --- balance and the framework gave us a total rather than a delta.
        delta = delta,
        --- The balance after the change, when it could be read.
        total = total,
        reason = reason,
    }

    for _, fn in ipairs(handlers) do
        local ok, err = pcall(fn, payload)
        if not ok then
            lib.print.error(('[money] onChange handler failed: %s'):format(tostring(err)))
        end
    end
end

--- Forget a player's cached balances when they leave, or the next player on
--- that server id inherits them and the first delta is nonsense.
AddEventHandler('playerDropped', function()
    local src = source
    for slot in pairs(lastKnown) do
        if slot:sub(1, #tostring(src) + 1) == src .. ':' then lastKnown[slot] = nil end
    end
end)

--============================================================
-- Framework wiring. Registered once, for whichever framework is active.
--============================================================

local wired = false

local function wire()
    if wired then return end
    wired = true

    local framework = settings.framework

    if framework == 'es_extended' then
        -- Three events, and only add/remove carry a delta.
        AddEventHandler('esx:addAccountMoney', function(src, account, amount, reason)
            emit(src, account, 'add', amount, reason)
        end)
        AddEventHandler('esx:removeAccountMoney', function(src, account, amount, reason)
            emit(src, account, 'remove', amount, reason)
        end)
        AddEventHandler('esx:setAccountMoney', function(src, account, amount, reason)
            emit(src, account, 'set', amount, reason)
        end)

    elseif framework == 'qb-core' or framework == 'qbx_core' then
        -- qbx_core has no event of its own; it fires the QBCore name verbatim,
        -- so this single handler serves both.
        AddEventHandler('QBCore:Server:OnMoneyChange', function(src, moneyType, amount, action, reason)
            emit(src, moneyType, action or 'set', amount, reason)
        end)

    elseif framework == 'ND_Core' then
        AddEventHandler('ND:moneyChange', function(src, account, amount, action, reason)
            emit(src, account, action or 'set', amount, reason)
        end)

    else
        lib.print.warn(('[money] no money events wired for framework "%s"'):format(tostring(framework)))
    end
end

--- Seed the cache when a player loads, so their first change reports a correct
--- delta rather than skipping it for want of a previous value.
local function seed(src)
    if not src then return end
    local ok, accounts = pcall(function() return lib.player.getAccounts(src) end)
    if not ok or type(accounts) ~= 'table' then return end
    for account, balance in pairs(accounts) do
        lastKnown[key(src, account)] = balance
    end
end

--============================================================
-- Public API
--============================================================

--- @class MoneyChange
--- @field source number
--- @field account string
--- @field action 'add'|'remove'|'set'
--- @field delta number|nil signed; positive in, negative out
--- @field total number|nil balance after the change
--- @field reason string|nil

---@function lib.money.onChange
---@description # Called whenever a player's balance changes, on any framework
---@description Normalises the per-framework events: you always get a signed
---@description delta and the new total, never a number whose meaning depends
---@description on which framework is running.
---@param fn fun(change: MoneyChange)
function money.onChange(fn)
    assert(type(fn) == 'function', 'lib.money.onChange expects a function')
    wire()
    handlers[#handlers + 1] = fn
    return #handlers
end

---@function lib.money.seed
---@description # Prime a player's cached balances (call on player loaded)
---@param src number
money.seed = seed

---@function lib.money.balances
---@description # Every account and balance for a player
---@param src number
---@return table<string, number>
function money.balances(src)
    local ok, accounts = pcall(function() return lib.player.getAccounts(src) end)
    return (ok and type(accounts) == 'table') and accounts or {}
end

return money
