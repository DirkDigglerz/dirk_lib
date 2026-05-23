-- lib.accounts — consumer proxy. The real introspection lives in
-- dirk_lib's `src/accounts/server.lua` so the framework detection runs
-- once in dirk_lib's VM and the cache is shared across every consumer.
--
-- Usage:
--   local info = lib.accounts.list()
--   -- info = { ok, framework, accounts = { { name, label?, default? } } }
--
-- info.ok is false when the framework couldn't be probed (e.g. starting
-- before es_extended has finished booting). The picker UI shows the
-- raw account list either way; an empty list just means "type manually".

local accounts = {}

function accounts.list()
  return exports.dirk_lib:accounts_list()
end

function accounts.clearCache()
  exports.dirk_lib:accounts_clearCache()
end

return accounts
