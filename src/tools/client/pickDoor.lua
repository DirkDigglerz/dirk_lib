-- Door picker dev tool. Appears in the dirk devtools menu (/devtools) and
-- is also callable as the slash command /pickDoor thanks to `command = true`.
--
-- Runs the in-world picker (raycast from camera, highlight aimed entity)
-- and prints the picked door's identifying info to F8 + a notify. Use for
-- verifying the picker works end-to-end (and the bottom-right Instructions
-- card renders properly) before plugging it into a consumer's admin UI.

DevTool.register('pickDoor', {
  label       = 'Pick Door',
  description = 'Aim at doors in-world; prints model hash, coords and heading for each picked',
  icon        = 'door-closed',
  command     = true, -- also registers /pickDoor as a chat command
  action      = function()
    CreateThread(function()
      local picked = lib.doorlock.pick()
      if not picked or not picked.doors or #picked.doors == 0 then
        print('[pickDoor] cancelled')
        lib.notify({ description = '[pickDoor] cancelled', type = 'warning' })
        return
      end
      print(('[pickDoor] confirmed %d door(s):'):format(#picked.doors))
      for i, d in ipairs(picked.doors) do
        print(('  %d. model=%s coords=vec3(%.4f, %.4f, %.4f) heading=%.2f'):format(
          i, tostring(d.model), d.coords.x, d.coords.y, d.coords.z, d.heading
        ))
      end
      lib.notify({
        description = ('Picked %d door(s)'):format(#picked.doors),
        type = 'success',
      })
    end)
  end,
})
