-- The log line kept HERE, so the panel has something to show.
--
-- lib.logger only ever shipped OUT - Datadog, Loki, Fivemanage. That is the
-- right answer for a server that runs one of those, and no answer at all for
-- everyone else: the Logs page had nothing to read, which is why it was mock
-- data pretending to be a server.
--
-- So there is a local sink. It is deliberately modest:
--
--   * OFF by default. A table that fills up on a server nobody asked is worse
--     than no page at all.
--   * Written from the emit path's own buffer, as ONE multi-row INSERT every
--     half second. A query per log line is how a busy server's fishing spree
--     turns into a thousand round trips a minute.
--   * Read by keyset (`WHERE id < cursor`), never OFFSET. Page 40 of an offset
--     scan reads the thirty-nine before it every time.
--   * Pruned on a timer, in chunks, so retention never holds the thread.

local sink = {}

local BUFFER_MS = 500
--- One INSERT is cheap; one INSERT with ten thousand rows in it is not. A
--- flush larger than this is split, so a burst cannot build a statement big
--- enough to trip max_allowed_packet.
local MAX_ROWS_PER_INSERT = 500

local config = { enabled = false, retentionDays = 14 }
local ready = false

local buffer, bufferSize = nil, 0

--- The table, and the indexes the PAGE actually queries by.
---
--- Not one index per column: the page filters by resource, event, player or
--- level and ALWAYS orders by id descending, so what it needs is each filter
--- paired with id. A bare index on `resource` would find every row for a
--- resource and then sort them; `(resource, id)` walks them newest-first and
--- stops at the page size.
local function ensureTable()
  local ok = pcall(MySQL.query.await, [[
    CREATE TABLE IF NOT EXISTS `dirk_logs` (
      `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      `at`         INT UNSIGNED NOT NULL,
      `resource`   VARCHAR(64)  NOT NULL,
      `event`      VARCHAR(64)  NOT NULL,
      `level`      VARCHAR(8)   NOT NULL DEFAULT 'info',
      `message`    TEXT         NOT NULL,
      `playerName` VARCHAR(64)      NULL,
      `identifier` VARCHAR(64)      NULL,
      `serverId`   INT              NULL,
      `tags`       JSON             NULL,
      PRIMARY KEY (`id`),
      KEY `idx_resource_id`   (`resource`, `id`),
      KEY `idx_event_id`      (`event`, `id`),
      KEY `idx_identifier_id` (`identifier`, `id`),
      KEY `idx_playerName_id` (`playerName`, `id`),
      KEY `idx_level_id`      (`level`, `id`),
      KEY `idx_at`            (`at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ]])

  if not ok then
    lib.print.error('[lib.logger] could not create `dirk_logs`. Check the database user has CREATE permission; the local log sink is off until it exists.')
    return false
  end
  return true
end

--- Throw the buffered lines at the database as one statement.
local function flush()
  local rows, count = buffer, bufferSize
  buffer, bufferSize = nil, 0
  if not rows or count == 0 then return end

  for start = 1, count, MAX_ROWS_PER_INSERT do
    local last = math.min(start + MAX_ROWS_PER_INSERT - 1, count)
    local chunk = {}
    for i = start, last do chunk[#chunk + 1] = rows[i] end

    -- `insert` with a table of value-lists is oxmysql's batch form: one
    -- statement, one round trip, however many rows are in it.
    MySQL.prepare(
      'INSERT INTO `dirk_logs` (`at`,`resource`,`event`,`level`,`message`,`playerName`,`identifier`,`serverId`,`tags`) VALUES (?,?,?,?,?,?,?,?,?)',
      chunk
    )
  end
end

--- Who this line is about, when it is about anyone.
---
--- Resolved at EMIT time, not at read time. A log line is a record of what
--- happened; looking the name up later would show whoever holds that server id
--- now, which after a reconnect is somebody else entirely.
local function playerFor(source)
  local src = tonumber(source)
  if not src or src <= 0 then return nil, nil, nil end

  local name = GetPlayerName(src)
  if not name then return nil, nil, src end

  local identifier
  if lib.player and lib.player.getIdentifier then
    local ok, found = pcall(lib.player.getIdentifier, src)
    if ok then identifier = found end
  end
  identifier = identifier or (GetPlayerIdentifierByType and GetPlayerIdentifierByType(src, 'license'))

  return name, identifier, src
end

--- Who a line is about, as a table - shared with the Discord routes so both
--- destinations name the same person the same way, resolved once.
function sink.playerFor(source)
  local name, identifier, serverId = playerFor(source)
  if not name and not serverId then return nil end
  return { name = name, identifier = identifier, source = serverId }
end

--- Take one line. Cheap, and never the caller's problem if it fails.
function sink.write(resource, source, event, message, level, tags)
  if not config.enabled or not ready then return end

  local name, identifier, serverId = playerFor(source)

  if not buffer then
    buffer = {}
    SetTimeout(BUFFER_MS, flush)
  end

  bufferSize += 1
  buffer[bufferSize] = {
    os.time(),
    resource or 'unknown',
    tostring(event or 'log'):sub(1, 64),
    level or 'info',
    tostring(message or ''),
    name,
    identifier,
    serverId,
    (tags and next(tags)) and json.encode(tags) or nil,
  }
end

--- Delete what has aged out, a slice at a time.
---
--- `DELETE ... LIMIT` in a loop rather than one unbounded DELETE: a server
--- coming back after a month away could otherwise ask InnoDB to remove a
--- million rows in a single statement, which locks the table for as long as it
--- takes and stalls every insert behind it.
local function prune()
  if not config.enabled or not ready then return end

  local cutoff = os.time() - (config.retentionDays * 86400)
  local removed = 0

  repeat
    local ok, affected = pcall(MySQL.update.await,
      'DELETE FROM `dirk_logs` WHERE `at` < ? LIMIT 2000', { cutoff })
    if not ok then return end
    removed = removed + (affected or 0)
    if (affected or 0) > 0 then Wait(250) end
  until (affected or 0) < 2000

  if removed > 0 then
    lib.print.info(('[lib.logger] pruned %d log rows older than %d days'):format(removed, config.retentionDays))
  end
end

--- Follow the settings, including being switched on while running.
function sink.configure(next)
  local wasEnabled = config.enabled
  config.enabled = next and next.enabled == true or false
  config.retentionDays = math.max(1, tonumber(next and next.retentionDays) or 14)

  if config.enabled and not ready then
    ready = ensureTable()
    if not ready then config.enabled = false end
  end

  -- Switching it on should not wait for the next boot to tidy up.
  if config.enabled and not wasEnabled then
    CreateThread(function() Wait(5000) prune() end)
  end
end

function sink.isEnabled() return config.enabled and ready end
function sink.retentionDays() return config.retentionDays end

CreateThread(function()
  -- Hourly is often enough for a day-grained retention, and never lands in the
  -- same tick as a restart's other work.
  while true do
    Wait(60 * 60 * 1000)
    prune()
  end
end)

return sink
