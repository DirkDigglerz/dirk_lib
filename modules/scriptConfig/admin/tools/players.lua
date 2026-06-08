-- Player listing admin tool — CLIENT side.
--
-- Registers the two query handlers the React side fires through
-- ADMIN_TOOL_QUERY. Each round-trips to a server callback (see
-- `src/helpers/players/server.lua` in dirk_lib) which does the actual
-- framework / MySQL work behind an ace-admin gate.
--
-- React shape (id, citizenId, name, charName, online) — see the framework
-- bridge "Player discovery" sections for the source-of-truth definition.

lib.adminTool.register('getOnlinePlayers', 'query', function()
  local result = lib.callback.await('dirk_lib:getOnlinePlayers')
  return result or {}
end)

lib.adminTool.register('searchPlayers', 'query', function(data)
  local opts = data and data.value or {}
  local result = lib.callback.await('dirk_lib:searchPlayers', opts)
  return result or {}
end)
