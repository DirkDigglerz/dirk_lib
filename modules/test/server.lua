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

-- ── Running a suite from Script Studio ───────────────────────────────────
--
-- The registry is per-VM, so dirk_lib cannot run another resource's tests: it
-- has to ask that resource. Every consumer declaring `dirk_lib 'test'` loads
-- this file, so every one of them answers on its own name.
--
-- A DELIBERATE loosening of the console-only stance above, and worth being
-- explicit about: `dirktest` is restricted to the server console because a
-- suite can have side effects - fishing's adds and removes items to prove the
-- inventory bridge works. This callback is gated on permission to EDIT that
-- script's config, which is a higher bar than being an admin and is already
-- enough to change any setting in it. Someone who can retune the whole script
-- can also run its tests.
lib.callback.register(('%s:test:run'):format(GetCurrentResourceName()), function(source, payload)
  if not source or source <= 0 then return false, 'InvalidSource' end

  local allowed = false
  local ok, result = pcall(function()
    return exports.dirk_lib:canEditScriptConfig(source, GetCurrentResourceName())
  end)
  if ok then allowed = result == true end
  if not allowed then return false, 'NoPermission' end

  local filter = type(payload) == 'table' and payload.filter or nil
  if filter == '' then filter = nil end

  -- One run at a time, across every admin on the server, with a short
  -- cooldown after. dirk_lib holds the lock because it is the one place that
  -- knows about every consumer.
  local resource = GetCurrentResourceName()
  local began, reason, detail = exports.dirk_lib:beginTestRun(resource, source)
  if not began then return false, reason or 'Busy', detail end

  local ok, res = pcall(test.runLocal, filter, source)
  if not ok or type(res) ~= 'table' then
    exports.dirk_lib:endTestRun(resource, nil)
    return false, 'NoTests'
  end

  local payloadOut = {
    passed = res.passed,
    failed = res.failed,
    skipped = res.skipped,
    cases = res.cases,
  }

  -- Cached from HERE rather than reported by the client: the result is what
  -- this VM actually produced, and nothing in between gets to edit it.
  exports.dirk_lib:endTestRun(resource, payloadOut)

  return true, nil, payloadOut
end)

return test
