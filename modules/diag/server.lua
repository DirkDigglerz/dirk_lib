-- ── lib.diag ───────────────────────────────────────────────────────────────
-- An opt-in, behaviour-preserving SQL diagnostics layer.
--
-- WHY: a live qb-core server hitches/hangs with SQL errors when dirk resources
-- run, and the errors could not be captured from a *separate* resource. So we
-- instrument the resources themselves — each consumer VM wraps ITS OWN oxmysql
-- MySQL methods, records per-query diagnostics, and dumps a report into ITS OWN
-- resource folder. Because lib.diag lives on the shared `lib` object, every
-- consumer VM that calls lib.diag.instrument() gets its own private copy that
-- operates on its own MySQL global + its own diag_report.json.
--
-- OPT-IN (this ships to ALL customers):
--   * The CONSUMER gates the call. instrument() wraps unconditionally, so callers
--     only call it when their scriptConfig `debug` flag is on (both dirk_fishing
--     and dirk_lib use basic.debug). When debug is off, instrument() is
--     never called — no wrap, no threads, no command, zero overhead and zero
--     behaviour change. See the gated call-sites in dirk_lib/src/init.lua and
--     dirk_fishing/src/server/diag.lua.
--   * BEHAVIOUR-PRESERVING. When on, the wrap returns the EXACT same values and
--     propagates errors EXACTLY as before. Every original call is made through
--     pcall so a diag-internal bug can never break or swallow a real query
--     result/error — on any diag failure we fall back to the original untouched.
--
-- All of this is server-only (oxmysql lives on the server).

-- Server-only (oxmysql lives on the server). On any non-server VM, hand back an
-- inert table so client-side `lib.diag.*` calls are safe no-ops.
if lib.context ~= 'server' then
  return { instrument = function() end, record = function() end, dump = function() end, enabled = false }
end

local resourceName = GetCurrentResourceName()
local startTime    = os.time()              -- coarse wall-clock start (seconds)
local QUERY_STORM_WINDOW = 15               -- seconds after start counted as "boot burst"

-- oxmysql method names we know about. Only ones that actually exist on this
-- VM's MySQL global are wrapped (qb / older installs may not expose all).
local METHODS = {
  'query', 'scalar', 'single', 'prepare', 'update', 'insert', 'transaction',
}

-- ── Aggregate state ──────────────────────────────────────────────────────────
local diag = {
  enabled  = true,
  resource = resourceName,
  -- byMethod[method] = { count, errors }
  byMethod = {},
  -- capped list of { query, err, atSeconds }
  errorSamples = {},
  -- capped list of { atSeconds, gapMs, lastQuery }
  hitches = {},
  queryStorm = {
    total       = 0,   -- total queries seen since start
    inFirst15s  = 0,   -- queries seen within the boot burst window
  },
  -- best-effort "what was the engine doing last" — feeds the hitch monitor so a
  -- CPU hang can be tied to the most recent query the VM issued.
  lastQuery = nil,
}

local ERROR_SAMPLE_CAP = 50
local HITCH_CAP        = 50

local instrumented = false   -- idempotency guard

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- Truncate + flatten a query string for storage: first ~120 chars, newlines and
-- runs of whitespace collapsed to single spaces. Tolerant of non-string input
-- (a prepare/transaction batch may pass a table of queries).
local function truncateQuery(sql)
  local s
  if type(sql) == 'string' then
    s = sql
  elseif type(sql) == 'table' then
    -- transaction / prepare batch: stitch the first few query strings together
    local parts = {}
    for i = 1, #sql do
      local q = sql[i]
      if type(q) == 'string' then
        parts[#parts + 1] = q
      elseif type(q) == 'table' and type(q.query) == 'string' then
        parts[#parts + 1] = q.query
      end
      if #parts >= 3 then break end
    end
    s = table.concat(parts, ' ; ')
    if s == '' then s = '[batch]' end
  else
    s = tostring(sql)
  end
  s = s:gsub('[\r\n]+', ' '):gsub('%s+', ' '):gsub('^%s+', '')
  if #s > 120 then s = s:sub(1, 120) end
  return s
end

-- Record one completed query. Never throws — wrapped in pcall by the caller but
-- defensive anyway since it touches shared tables.
local function record(method, sql, ok, err, durationMs)
  local truncated = truncateQuery(sql)
  diag.lastQuery = truncated

  local m = diag.byMethod[method]
  if not m then
    m = { count = 0, errors = 0 }
    diag.byMethod[method] = m
  end
  m.count = m.count + 1

  diag.queryStorm.total = diag.queryStorm.total + 1
  if (os.time() - startTime) <= QUERY_STORM_WINDOW then
    diag.queryStorm.inFirst15s = diag.queryStorm.inFirst15s + 1
  end

  if not ok then
    m.errors = m.errors + 1
    if #diag.errorSamples < ERROR_SAMPLE_CAP then
      diag.errorSamples[#diag.errorSamples + 1] = {
        method    = method,
        query     = truncated,
        err       = err ~= nil and tostring(err) or 'unknown error',
        atSeconds = os.time() - startTime,
        durationMs = durationMs,
      }
    end
  end
end
diag.record = record

-- ── Dump ─────────────────────────────────────────────────────────────────────
-- Each resource writes ITS OWN report into its own folder. No cross-resource
-- calls. json.encode + SaveResourceFile, both fully pcall-guarded.
local function dump()
  local ok, err = pcall(function()
    local payload = {
      resource     = resourceName,
      generatedAt  = os.date('%Y-%m-%d %H:%M:%S'),
      uptimeSecs   = os.time() - startTime,
      byMethod     = diag.byMethod,
      queryStorm   = diag.queryStorm,
      errorSamples = diag.errorSamples,
      hitches      = diag.hitches,
      lastQuery    = diag.lastQuery,
    }
    local encoded = json.encode(payload, { indent = true })
    if encoded then
      SaveResourceFile(resourceName, 'diag_report.json', encoded, -1)
    end
  end)
  if not ok then
    -- Never let a dump failure ripple out. Surface it quietly.
    pcall(lib.print.warn, ('[diag] dump failed: %s'):format(tostring(err)))
  end
end
diag.dump = dump

-- ── Method wrapping ──────────────────────────────────────────────────────────
-- oxmysql exposes each method as a CALLABLE TABLE:
--   MySQL.query(sql, params, cb)        -- async / callback form, returns nil
--   MySQL.query.await(sql, params)      -- sync form, returns the result
-- We must preserve BOTH. Strategy: build a NEW callable table per method whose
-- __call wraps the original __call (the async form) and whose `.await` wraps the
-- original `.await`. Any other fields on the original (rare) are copied through
-- so nothing the engine relies on disappears.
--
-- EVERY original invocation goes through pcall so a diag bug can never break a
-- real query. On a diag-internal failure we fall back to calling the original
-- untouched (no recording), so behaviour is identical to un-instrumented.

-- Wrap a single callable (either the async `__call` or the `.await` function).
-- `caller` is the raw original function. `sqlIndex` is which vararg position
-- holds the query string for LOGGING ONLY (the call itself forwards every arg
-- verbatim, so this never affects behaviour):
--   * .await is invoked directly as (query, parameters)        -> sqlIndex 1
--   * the async form is invoked via __call as (self, query, …) -> sqlIndex 2
-- Returns a function with the same signature/return contract as `caller`.
local function wrapCallable(method, caller, sqlIndex)
  return function(...)
    -- Pull the sql arg for logging only. For transaction it may be a table —
    -- truncateQuery handles both string and table.
    local sql = select(sqlIndex, ...)

    local t0 = os.clock()  -- CPU time. DB awaits yield, so their delta ~= 0 — that's expected (per spec).

    -- Call the ORIGINAL through pcall so we never alter its observable result or
    -- error behaviour. We re-raise / re-return below to match the original
    -- contract exactly. table.pack preserves an exact count (incl. trailing nils)
    -- so multi-return contracts are reproduced verbatim.
    local results = table.pack(pcall(caller, ...))
    local pcallOk = results[1]

    local durationMs = (os.clock() - t0) * 1000

    if pcallOk then
      -- Original succeeded. results[2..n] are its real return values.
      -- Record best-effort (recording itself is pcall'd so it cannot break us).
      pcall(record, method, sql, true, nil, durationMs)
      -- Return the original's values verbatim (exact arity preserved).
      return table.unpack(results, 2, results.n)
    else
      -- Original raised. results[2] is the error object/message. Record it as a
      -- failure, then RE-RAISE the exact same error so callers (incl. their own
      -- pcall(MySQL.query.await, ...)) see identical behaviour.
      pcall(record, method, sql, false, results[2], durationMs)
      error(results[2], 0)  -- level 0: preserve the original message verbatim
    end
  end
end

-- Build a behaviour-preserving replacement for one MySQL method table.
local function wrapMethod(MySQL, method)
  local original = MySQL[method]
  if original == nil then return end  -- method not present on this VM — skip.

  -- The async/callback form: oxmysql makes the method table itself callable.
  local mt = getmetatable(original)
  local originalCall = mt and mt.__call
  local originalAwait = type(original) == 'table' and original.await or nil

  -- If we can't see a callable original at all, leave it completely untouched.
  if not originalCall and not originalAwait then return end

  -- New callable table. Copy any non-await fields from the original so nothing
  -- the engine references silently vanishes.
  local replacement = {}
  if type(original) == 'table' then
    for k, v in pairs(original) do
      if k ~= 'await' then replacement[k] = v end
    end
  end

  if originalAwait then
    -- await(query, parameters) — sql is vararg 1.
    replacement.await = wrapCallable(method, function(...)
      return originalAwait(...)
    end, 1)
  end

  -- Make `replacement` callable, forwarding to the original async __call.
  if originalCall then
    -- __call is invoked as (self, query, parameters, cb) — sql is vararg 2.
    setmetatable(replacement, {
      __call = wrapCallable(method, function(self, ...)
        -- originalCall expects (self, query, …) and dispatches on self.method.
        -- Pass the ORIGINAL table as self so self.method resolves correctly.
        return originalCall(original, ...)
      end, 2),
    })
  end

  MySQL[method] = replacement
end

-- ── Threads + command ─────────────────────────────────────────────────────────

local function startHitchMonitor()
  CreateThread(function()
    -- Wait(0) each tick and measure os.clock() (CPU time) delta. A gap > 0.1s on
    -- a Wait(0) loop means the VM busy-looped / hung WITHOUT yielding — exactly
    -- the un-yielded CPU hang we're hunting. Tie it to the last query seen.
    local last = os.clock()
    while true do
      Wait(0)
      local now = os.clock()
      local gap = now - last
      last = now
      if gap > 0.1 then
        if #diag.hitches < HITCH_CAP then
          diag.hitches[#diag.hitches + 1] = {
            atSeconds = os.time() - startTime,
            gapMs     = math.floor(gap * 1000 + 0.5),
            lastQuery = diag.lastQuery,
          }
        end
      end
    end
  end)
end

local function startPeriodicDump()
  CreateThread(function()
    while true do
      Wait(30000)  -- dump every 30s while enabled
      dump()
    end
  end)
end

-- ── instrument() ──────────────────────────────────────────────────────────────
-- Entry point. Gated (returns immediately if convar off — handled at top).
-- Idempotent: wrapping more than once would double-count, so guard it.
-- Wraps THIS vm's MySQL, starts the timer + hitch thread, registers the dump
-- command. Everything pcall-guarded so instrument() can never break startup.
local function instrument()
  if instrumented then return end
  instrumented = true

  -- MySQL must already exist (oxmysql's MySQL.lua loads first in server_scripts).
  -- If it isn't there yet we still arm the threads/command — but there's nothing
  -- to wrap, which is a misconfiguration we surface rather than silently eat.
  local mysql = rawget(_G, 'MySQL')
  if type(mysql) == 'table' then
    for _, method in ipairs(METHODS) do
      local ok, err = pcall(wrapMethod, mysql, method)
      if not ok then
        pcall(lib.print.warn, ('[diag] failed to wrap MySQL.%s: %s'):format(method, tostring(err)))
      end
    end
  else
    pcall(lib.print.warn, '[diag] MySQL global not found at instrument() time — queries will not be recorded')
  end

  pcall(startHitchMonitor)
  pcall(startPeriodicDump)

  -- Manual dump command. Registered once.
  pcall(RegisterCommand, 'dirkdiagdump', function()
    dump()
    pcall(lib.print.info, ('[diag] %s wrote diag_report.json (total=%d, first15s=%d, errors=%d, hitches=%d)'):format(
      resourceName,
      diag.queryStorm.total,
      diag.queryStorm.inFirst15s,
      #diag.errorSamples,
      #diag.hitches
    ))
  end, true)  -- restricted = true (server console / ace only)

  pcall(lib.print.info, ('[diag] enabled for %s — SQL instrumentation active'):format(resourceName))
end
diag.instrument = instrument

return diag
