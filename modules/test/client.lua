-- CLIENT runner endpoint. The server's `dirktest ... +c` awaits this to run the
-- client/shared tests on this player and return the results (server -> client).
--
-- This callback only exists once lib.test has been touched on the client — so a
-- resource that wants client tests must either register a client test (which
-- touches lib.test) or declare `dirk_lib 'test'` in its fxmanifest to force-load
-- the module in both contexts. See dirk_lib/init.lua's metadata force-loader.

-- The runClient endpoint the server's `dirktest ... +c` awaits. It only responds
-- to the console-only server command, so no extra gate is needed here.
lib.callback.register('dirk_lib:test:runClient', function(filter)
  if filter == '*' or filter == '' then filter = nil end
  -- On the client the "player" is us; pass our own server id (or true) so
  -- requiresPlayer client tests aren't skipped.
  return test.runLocal(filter, (cache and cache.serverId) or true)
end)

return test
