-- lib.showInstructions — bottom-right "do this in-world" instruction card.
--
-- General-purpose primitive next to lib.notify / lib.showText / lib.progress.
-- Drives the <InstructionPanel> React component (from dirk-cfx-react) that's
-- mounted inside dirk_lib's own always-loaded NUI, so any resource — UI or
-- not — can show the same card without needing its own React tree.
--
-- Usage:
--   lib.showInstructions({
--     title = 'Pick Door',
--     hint  = 'Aim at a door in the world',
--     keys  = {
--       { key = 'LMB', action = 'Confirm' },
--       { key = 'ESC', action = 'Cancel'  },
--     },
--   })
--   -- ... do the in-world work ...
--   lib.hideInstructions()
--
-- The React side ignores stale shows once hideInstructions has fired, and
-- a fresh show before hide replaces the visible card (no stacking).

local function send(action, data)
  SendNuiMessage(json.encode({
    action = action,
    data   = data,
  }))
end

-- Resource that opened the currently-showing card (nil when nothing is up).
-- Tracked so a mid-flow restart/stop of that resource can't leave the card
-- stranded on screen forever (it never gets to call hideInstructions).
local owner = nil

---@class InstructionKey
---@field key    string  -- short label inside the key cap, e.g. 'E', '⌫', 'LMB'
---@field action string  -- what the key does, e.g. 'Confirm', 'Cancel'

---@class InstructionSpec
---@field title string                 -- header line
---@field hint  string?                -- optional sub-text
---@field keys  InstructionKey[]?      -- optional list of key bindings

---Show the bottom-right instruction card. Safe to call repeatedly — the
---last call wins, no stacking.
---@param spec InstructionSpec
function lib.showInstructions(spec)
  if type(spec) ~= 'table' or type(spec.title) ~= 'string' then
    lib.print.warn('[lib.showInstructions] spec.title (string) is required')
    return
  end
  owner = GetInvokingResource() or GetCurrentResourceName()
  send('DIRK_LIB_SHOW_INSTRUCTIONS', {
    title = spec.title,
    hint  = spec.hint,
    keys  = spec.keys,
  })
end

---Hide the bottom-right instruction card. No-op if nothing is showing.
function lib.hideInstructions()
  owner = nil
  send('DIRK_LIB_HIDE_INSTRUCTIONS', {})
end

-- If the resource that opened the card stops (a mid-flow restart, say), it never
-- gets to call hideInstructions — so hide it here or the card stays on screen
-- forever, which also visually strands the player.
AddEventHandler('onClientResourceStop', function(res)
  if owner and res == owner then
    owner = nil
    send('DIRK_LIB_HIDE_INSTRUCTIONS', {})
  end
end)
