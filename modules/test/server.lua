-- SERVER runner: the `dirktest` console command.
--
--   dirktest [filter] [playerId] [+c]
--
-- Runs this resource's server/shared tests. With `+c` it also runs the
-- client/shared tests on the target player (server -> client via lib.callback) —
-- that leg needs lib.test loaded on the CLIENT too, which is what declaring
-- `dirk_lib 'test'` in the consumer fxmanifest guarantees (force-loads the module
-- in both contexts; see the loader in dirk_lib/init.lua).
--
-- NOTE: the test registry is per-VM, so `dirktest` runs the tests of the
-- resource that owns this command. Keep a suite's tests in one resource.

-- SECURITY: `dirktest` is CONSOLE-ONLY. The `source ~= 0` guard below means only
-- the server console (the owner/admin) can ever run it — a connected player
-- cannot, no matter their permissions. It's also a `restricted` command (ace
-- command.dirktest). So no gating convar is needed: the runner is safe to have
-- present; it simply does nothing when a resource ships no tests.
local function resolvePlayer(explicit)
  if explicit then return explicit end
  local players = GetPlayers()
  return players[1] and tonumber(players[1]) or nil
end

RegisterCommand('dirktest', function(source, args)
  if source ~= 0 then return end -- console only

  local filter, player, withClient
  for _, a in ipairs(args) do
    if a == '+c' then withClient = true
    elseif tonumber(a) then player = tonumber(a)
    elseif a ~= '*' and a ~= '' then filter = a end
  end
  player = resolvePlayer(player)

  CreateThread(function()
    print(('^5[lib.test]^7 running %s%s%s'):format(
      filter and ('filter="' .. filter .. '" ') or 'all ',
      player and ('player=' .. player .. ' ') or '(no player) ',
      withClient and '+client' or ''))

    test.report('SERVER', test.runLocal(filter, player))

    if withClient then
      if not player then
        print('^3[lib.test]^7 +c requested but no player connected — client tests skipped')
        return
      end
      local ok, clientRes = pcall(lib.callback.await, 'dirk_lib:test:runClient', player, filter or '*')
      if ok and type(clientRes) == 'table' then
        test.report('CLIENT[' .. player .. ']', clientRes)
      else
        print("^3[lib.test]^7 client tests unavailable — is lib.test loaded on the client? (declare `dirk_lib 'test'`)")
      end
    end
  end)
end, true)

return test
