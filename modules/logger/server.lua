-- lib.logger — consumer-facing proxy. The real backend selection, buffering,
-- credentials, and POST handling live in dirk_lib's own VM at
-- `src/logger/server.lua`. This module just forwards each emit through an
-- export so:
--
--   * Backend secrets (Datadog API key, Loki password, Fivemanage key) never
--     enter the consumer's VM image — they're driven from dirk_lib's OWN
--     scriptConfig (the `logger` block in /dirk_config), which a consumer VM
--     cannot read.
--   * One shared 500ms buffer/flush across every consumer instead of N
--     independent per-VM buffers.
--   * The backend can be switched live in the admin panel without restarting
--     every consumer.
--
-- API surface is unchanged: `lib.logger(source, event, message, ...)`, so
-- existing `if lib.logger then lib.logger(...) end` call-sites keep working.
-- Legacy `dirk:logger` + per-backend convars still work as a fallback (handled
-- inside src/logger/server.lua) for back-compat.

-- Emit one log line. nil-safe: if dirk_lib hasn't started yet (or the export
-- isn't up), swallow rather than erroring the caller. `...` is forwarded as
-- direct pcall args (NOT captured in a closure — a nested function gets its own
-- empty `...`, which would silently drop the tags).
local function emit(source, event, message, ...)
    local ok, r = pcall(exports.dirk_lib.logger_emit, exports.dirk_lib, source, event, message, ...)
    return ok and r or nil
end

-- `lib.logger` is a CALLABLE TABLE: `lib.logger(src, event, msg, ...)` still
-- works via __call, `if lib.logger then` is still truthy, AND it now also
-- carries `lib.logger.isConfigured()`.
--
-- NOTE on the truthiness contract: `lib.logger` is now ALWAYS present (the
-- callable exists even when no backend is configured — it just no-ops inside
-- dirk_lib's VM). Consumers that used `lib.logger ~= nil` to detect "is an
-- external sink configured?" should switch to `lib.logger.isConfigured()`,
-- which returns the active destination ('datadog'|'loki'|'fivemanage'|'local')
-- or nil when nothing at all will receive the line. 'local' means dirk_lib's
-- own log table - the one the Logs page reads - which is a destination like
-- any other, and the reason this predicate exists rather than a nil check on
-- lib.logger itself. No credential ever crosses this boundary.
lib.logger = setmetatable({
    isConfigured = function()
        local ok, r = pcall(function()
            return exports.dirk_lib:logger_isConfigured()
        end)
        return ok and r or nil
    end,
}, {
    __call = function(_, source, event, message, ...)
        return emit(source, event, message, ...)
    end,
})

return lib.logger
