-- Who can open Script Studio, beyond the master group.
--
-- Access used to be two things: the `dirk_lib_master_group` convar, and each
-- script's own access block in its schema. Both are files - so granting a
-- moderator access meant editing a schema and restarting, and there was no way
-- to say "look, don't touch".
--
-- This is the third source: rows a master adds from the panel.
--
-- IN ITS OWN TABLE, not in scriptConfig. Storing the access list in the thing
-- the access list guards is circular - a bad write locks everyone out of the
-- panel that would fix it. A separate table also means the master convar is
-- always a way back in, whatever is in here.
--
-- A row names either a player (identifier) or an ACE principal (group.mod), so
-- servers that already run ACE groups can grant a whole group at once, and
-- servers that do not can name people directly.

local admins = {}

--- Rows, in memory. Read on every access check, so it is never a query.
local cache = nil

--- The two levels. `edit` may change settings; `view` may look and nothing
--- else - no server-only values, no saves, no give-item.
local LEVELS = { edit = true, view = true }

local function ensureTable()
  MySQL.query.await([[
    CREATE TABLE IF NOT EXISTS `dirk_admins` (
      `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      `kind` ENUM('identifier','principal') NOT NULL DEFAULT 'identifier',
      `subject` VARCHAR(96) NOT NULL,
      `name` VARCHAR(64) DEFAULT NULL,
      `level` ENUM('edit','view') NOT NULL DEFAULT 'view',
      -- JSON array of resource names. Empty means every script, which is the
      -- common case and must not need a row per script to express.
      `scripts` TEXT DEFAULT NULL,
      `addedBy` VARCHAR(64) DEFAULT NULL,
      `addedAt` INT UNSIGNED DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `subject` (`kind`,`subject`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ]])
end

local function decodeScripts(raw)
  if type(raw) ~= 'string' or raw == '' then return {} end
  local ok, list = pcall(json.decode, raw)
  return (ok and type(list) == 'table') and list or {}
end

--- Load every row into memory. Cheap: this is a staff list, not a log.
function admins.load()
  local ok, rows = pcall(MySQL.query.await,
    'SELECT `id`,`kind`,`subject`,`name`,`level`,`scripts`,`addedBy`,`addedAt` FROM `dirk_admins`')

  if not ok or type(rows) ~= 'table' then
    -- A failed read must not silently mean "nobody has access" - but it also
    -- must not mean "everybody does". An empty cache falls back to master
    -- only, which is the safe direction and always reachable.
    cache = {}
    return cache
  end

  for i = 1, #rows do rows[i].scripts = decodeScripts(rows[i].scripts) end
  cache = rows
  return cache
end

function admins.all()
  if not cache then admins.load() end
  return cache
end

--- Does this row apply to this resource?
---
--- An empty scripts list means every script. Listing them all instead would
--- go stale the moment a new script is installed.
local function coversResource(row, resourceName)
  local list = row.scripts
  if type(list) ~= 'table' or #list == 0 then return true end
  for i = 1, #list do
    if list[i] == resourceName then return true end
  end
  return false
end

--- The level these rows grant, or nil.
---
--- `matches(row)` is supplied by the caller because identifier matching needs
--- the player's resolved context and principal matching needs the native -
--- both of which live with the access check, not with storage.
---
--- Highest wins: someone in a view group and named directly as an editor is an
--- editor. Access rows are additive, the same rule the rest of the model uses.
function admins.levelFor(resourceName, matches)
  local best = nil
  local rows = admins.all()
  for i = 1, #rows do
    local row = rows[i]
    if coversResource(row, resourceName) and matches(row) then
      if row.level == 'edit' then return 'edit' end
      best = best or row.level
    end
  end
  return best
end

--- Add or update one row. Returns the row, or nil + why.
function admins.put(entry)
  local kind = entry.kind == 'principal' and 'principal' or 'identifier'
  local subject = type(entry.subject) == 'string' and entry.subject:gsub('^%s*(.-)%s*$', '%1') or ''
  if subject == '' then return nil, 'NoSubject' end
  if not LEVELS[entry.level] then return nil, 'BadLevel' end

  local scripts = {}
  if type(entry.scripts) == 'table' then
    for i = 1, #entry.scripts do
      if type(entry.scripts[i]) == 'string' and entry.scripts[i] ~= '' then
        scripts[#scripts + 1] = entry.scripts[i]
      end
    end
  end

  local ok = pcall(MySQL.query.await, [[
    INSERT INTO `dirk_admins` (`kind`,`subject`,`name`,`level`,`scripts`,`addedBy`,`addedAt`)
    VALUES (?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      `name` = VALUES(`name`), `level` = VALUES(`level`), `scripts` = VALUES(`scripts`)
  ]], {
    kind, subject, entry.name, entry.level,
    #scripts > 0 and json.encode(scripts) or nil,
    entry.addedBy, os.time(),
  })

  if not ok then return nil, 'QueryFailed' end
  admins.load()
  return true
end

function admins.remove(id)
  local n = tonumber(id)
  if not n then return false, 'BadId' end
  local ok = pcall(MySQL.query.await, 'DELETE FROM `dirk_admins` WHERE `id` = ?', { math.floor(n) })
  if not ok then return false, 'QueryFailed' end
  admins.load()
  return true
end

--- Which scripts have had their old per-script `access` block folded in.
---
--- Recorded so it happens once. Without this, deleting a migrated row would
--- see it reappear on the next restart - which is not a revoke, it is a
--- fifteen-second undo.
local migrated = {}

local function ensureMigrationTable()
  MySQL.query.await([[
    CREATE TABLE IF NOT EXISTS `dirk_admin_migrations` (
      `resource` VARCHAR(64) NOT NULL,
      `at` INT UNSIGNED DEFAULT NULL,
      PRIMARY KEY (`resource`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ]])

  local ok, rows = pcall(MySQL.query.await, 'SELECT `resource` FROM `dirk_admin_migrations`')
  if ok and type(rows) == 'table' then
    for i = 1, #rows do migrated[rows[i].resource] = true end
  end
end

--- Has this script's access block already been folded into the rows?
function admins.isMigrated(resource)
  return migrated[resource] == true
end

--- Fold one script's `access` block into rows, once.
---
--- The block is NOT written to or cleared - that is the consumer's own config
--- and dirk_lib has no business editing it. Instead the block stops being
--- HONOURED for a migrated script (see pushedOverrideAllows), so these rows
--- become the only thing granting access and deleting one actually revokes.
--- The original data stays exactly where it was, which is also the way back
--- if this ever needs undoing.
---
--- Everything migrates at `edit`, because that is what the old block granted.
function admins.migrateAccessBlock(resource, groups, identifiers)
  if migrated[resource] then return false end

  local rows = 0
  for i = 1, #(groups or {}) do
    if admins.put({
      kind = 'principal', subject = groups[i], level = 'edit',
      scripts = { resource }, addedBy = 'migrated from ' .. resource,
    }) then rows = rows + 1 end
  end
  for i = 1, #(identifiers or {}) do
    if admins.put({
      kind = 'identifier', subject = identifiers[i], level = 'edit',
      scripts = { resource }, addedBy = 'migrated from ' .. resource,
    }) then rows = rows + 1 end
  end

  -- Marked even when there was nothing to move, so an empty block is not
  -- reconsidered on every boot.
  local ok, err = pcall(MySQL.query.await,
    'INSERT IGNORE INTO `dirk_admin_migrations` (`resource`,`at`) VALUES (?,?)',
    { resource, os.time() })
  if not ok then
    lib.print.warn(('[dirk_lib] access migration for %s could not be recorded: %s')
      :format(resource, tostring(err)))
    return false
  end

  migrated[resource] = true
  if rows > 0 then
    lib.print.info(('[dirk_lib] moved %d access grant(s) from %s into the Admins page. Manage them there from now on.')
      :format(rows, resource))
  end
  return true
end

CreateThread(function()
  ensureTable()
  ensureMigrationTable()
  admins.load()
end)

return admins
