-- Pick-door admin tool — dirk_lib-owned.
--
-- Lives in src/devtools so it loads once in dirk_lib's own VM, not in
-- every consumer that pulls dirk_lib 'scriptConfig'. Critical reasons
-- to keep this here and NOT under modules/scriptConfig/admin/tools:
--
--   1. The picker calls lib.showInstructions / DrawSphere / etc. These
--      render the SAME way regardless of which VM they're called from,
--      but the consumer's NUI iframe (when running in the consumer's VM)
--      was compositing on top of immediate-mode draws — leaving the
--      sphere invisible. Running from dirk_lib's VM matches the /pickDoor
--      slash command's render path exactly.
--
--   2. Locale strings can live in one place (dirk_lib en.json) instead
--      of every consumer needing to mirror every dirk locale key. The
--      picker prompt text is fixed across all uses anyway.
--
-- React side fires the existing ADMIN_TOOL_BEGIN NUI callback in its own
-- consumer resource; modules/scriptConfig/admin/init.lua forwards that
-- to us via the `dirk_lib:adminTool:pickDoor:begin` event. When we're
-- done we fire `dirk_lib:adminTool:pickDoor:result` carrying the picker
-- output + the originating resource name, and the same init.lua
-- SendNuiMessages back into the consumer's NUI so the React promise
-- resolver settles cleanly.

local TOOL_ID = 'pickDoor'

local picking = false

AddEventHandler('dirk_lib:adminTool:' .. TOOL_ID .. ':begin', function(originResource)
  if picking then return end
  picking = true

  -- NUI focus is the consumer's problem (per-resource native). The
  -- consumer's forwarder in modules/scriptConfig/admin/init.lua
  -- releases focus before triggering this event and regrabs on result.

  CreateThread(function()
    local picked = lib.doorlock.pick({
      title = 'Pick Door',
      hint  = 'Add doors to the group, then confirm',
      keys  = {
        { key = 'LMB',       action = 'Toggle'  },
        { key = 'E',         action = 'Confirm' },
        { key = 'BACKSPACE', action = 'Cancel'  },
      },
    })

    picking = false

    if picked and picked.doors and #picked.doors > 0 then
      -- Serialise into a plain table so SendNuiMessage round-trips it
      -- cleanly into the React-side PickedDoorGroup shape.
      local panels = {}
      for i, d in ipairs(picked.doors) do
        panels[i] = {
          model   = d.model,
          coords  = { x = d.coords.x, y = d.coords.y, z = d.coords.z },
          heading = d.heading,
          isDoor  = d.isDoor,
        }
      end
      TriggerEvent('dirk_lib:adminTool:' .. TOOL_ID .. ':result', originResource, { doors = panels })
    else
      TriggerEvent('dirk_lib:adminTool:' .. TOOL_ID .. ':result', originResource, nil)
    end
  end)
end)

-- Safety: clear the picking flag if dirk_lib itself stops mid-pick.
-- Focus restoration is the consumer's responsibility (per-resource).
AddEventHandler('onResourceStop', function(name)
  if name ~= GetCurrentResourceName() then return end
  if picking then picking = false end
end)
