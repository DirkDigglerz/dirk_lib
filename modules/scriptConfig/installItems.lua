-- --------------------------------------------------
-- INSTALL FILE GENERATOR
-- --------------------------------------------------
-- Walks the consumer's schema for `x-installItem` (scalar fields holding a
-- single item name) and `x-installItemList` (arrays where each entry IS an
-- item record) annotations, builds a unified item-records list, and writes
-- ready-to-paste installation files into the consumer's resource folder:
--
--   INSTALLATION/itemsToAdd/ox.lua    — ox_inventory items table syntax
--   INSTALLATION/itemsToAdd/qb.lua    — qb-inventory items table syntax
--   INSTALLATION/itemsToAdd/esx.sql   — INSERT statements for ESX legacy items
--
-- Auto-fires on every scriptConfig load + change, so editing labels in the
-- admin updates the install files automatically. Same annotations drive the
-- missing-items audit so consumers don't duplicate the item list anywhere.
--
-- Annotation shapes:
--
--   "x-installItem": { label, weight?, description?, useable?, shouldClose?,
--                      unique?, stack?, image? }
--     Goes on a string-typed schema field whose value IS the item name. The
--     annotation block carries the install metadata (label, weight, etc.).
--
--   "x-installItemList": true | { nameField?, labelField?, descriptionField?,
--                                 weightField?, useable?, shouldClose?,
--                                 unique?, stack?, image? }
--     Goes on an array-typed schema field whose entries already carry their
--     own name/label/description/weight (e.g. fish[], equipment.rods[]).
--     Boolean `true` uses convention defaults (`name`, `label`, `description`,
--     `weight`); a table override lets you point to differently-named fields
--     and set per-format flags applied to every entry in the list.

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

-- Lua-string render with backslash + quote escaping, mirrors what the old
-- install.lua produced via lib.table.convert (just done explicitly here).
local function luaString(s)
  if s == nil then return '""' end
  local str = tostring(s):gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n')
  return '"' .. str .. '"'
end

local function sqlString(s)
  if s == nil then return "''" end
  return "'" .. tostring(s):gsub("'", "''") .. "'"
end

-- ── Schema walker ────────────────────────────────────────────────────────────

-- Resolve a value from `data` at the dot-path corresponding to `pathParts`
-- (e.g. {"basic","fishGuttingItem"}). Used to read item names out of the
-- live scriptConfig at the same paths the schema walker is at.
local function getAtPath(data, pathParts)
  local cur = data
  for i = 1, #pathParts do
    if type(cur) ~= 'table' then return nil end
    cur = cur[pathParts[i]]
  end
  return cur
end

-- Push a finalised item record into `out` if the name is a non-empty string.
-- `record` is the partial install metadata; `name` is the resolved item id.
local function pushRecord(out, name, record)
  if type(name) ~= 'string' or name == '' then return end
  out[#out + 1] = {
    name        = name,
    label       = record.label or name,
    weight      = tonumber(record.weight) or 0,
    description = record.description or '',
    useable     = record.useable == true,
    shouldClose = record.shouldClose == true,
    unique      = record.unique == true,
    stack       = record.stack ~= false,  -- default true (stackable) unless explicitly false
    image       = type(record.image) == 'string' and record.image or nil,
  }
end

-- Resolve a "#/definitions/foo" JSON-Schema $ref against the root schema.
-- Returns the referenced node, or nil if the ref isn't resolvable.
local function resolveRef(rootSchema, refPath)
  if type(refPath) ~= 'string' or refPath:sub(1, 2) ~= '#/' then return nil end
  local cur = rootSchema
  for segment in refPath:sub(3):gmatch('[^/]+') do
    if type(cur) ~= 'table' then return nil end
    cur = cur[segment]
  end
  return type(cur) == 'table' and cur or nil
end

local function walk(schemaNode, data, pathParts, out, rootSchema)
  if type(schemaNode) ~= 'table' then return end

  -- Resolve $ref before doing anything else — annotations inside the
  -- referenced node (e.g. definitions/stage's requiredItems) should still
  -- be reachable from any field that uses the ref.
  if type(schemaNode['$ref']) == 'string' then
    local resolved = resolveRef(rootSchema, schemaNode['$ref'])
    if resolved then schemaNode = resolved end
  end

  -- Handle x-installItem on the current node (scalar single-item field)
  local installItem = schemaNode['x-installItem']
  if type(installItem) == 'table' then
    local name = getAtPath(data, pathParts)
    pushRecord(out, name, installItem)
  end

  -- Handle x-installItemList on the current node (array of item records)
  local installList = schemaNode['x-installItemList']
  if installList ~= nil then
    local arr = getAtPath(data, pathParts)
    if type(arr) == 'table' then
      local cfg = type(installList) == 'table' and installList or {}
      local nameField        = cfg.nameField        or 'name'
      local labelField       = cfg.labelField       or 'label'
      local descriptionField = cfg.descriptionField or 'description'
      local weightField      = cfg.weightField      or 'weight'
      for i = 1, #arr do
        local entry = arr[i]
        if type(entry) == 'table' then
          -- weightField can resolve to a number (use directly), or a table —
          -- if a table, treat as array and use the first element. Lets fish
          -- entries point `weightField` at `weightLimits` (an array) and get
          -- the species' min weight as the inventory-table default, mirroring
          -- the old hand-rolled install.lua.
          local rawWeight = entry[weightField]
          if type(rawWeight) == 'table' then rawWeight = rawWeight[1] end
          pushRecord(out, entry[nameField], {
            label       = entry[labelField] or entry[nameField],
            weight      = rawWeight,
            description = entry[descriptionField],
            useable     = cfg.useable,
            shouldClose = cfg.shouldClose,
            unique      = cfg.unique,
            stack       = cfg.stack,
            image       = cfg.image,
          })
        end
      end
    end
  end

  -- Recurse into object properties
  if type(schemaNode.properties) == 'table' then
    for key, child in pairs(schemaNode.properties) do
      pathParts[#pathParts + 1] = key
      walk(child, data, pathParts, out, rootSchema)
      pathParts[#pathParts] = nil
    end
  end

  -- Recurse into array items by iterating the actual data array. Each entry
  -- gets visited with the path extended by its numeric index so annotations
  -- on the item schema (or on properties nested deeper, e.g.
  -- labs[].stages[].requiredItems) can resolve their data values via
  -- getAtPath. Without this we miss every annotation that lives inside an
  -- array's item shape — including druglabsv2's stage.requiredItems /
  -- rewardItems / ingOrders.items.
  if type(schemaNode.items) == 'table' then
    local arr = getAtPath(data, pathParts)
    if type(arr) == 'table' then
      for i = 1, #arr do
        pathParts[#pathParts + 1] = i
        walk(schemaNode.items, data, pathParts, out, rootSchema)
        pathParts[#pathParts] = nil
      end
    end
  end
end

local function collectInstallItems(schema, scriptConfig)
  local out = {}
  walk(schema, scriptConfig, {}, out, schema)
  -- Dedupe by name — last writer wins. Common when the same item is referenced
  -- both as a list entry and as a scalar override; the scalar's metadata is
  -- usually richer so let it overwrite.
  local seen = {}
  local deduped = {}
  for i = 1, #out do
    local rec = out[i]
    seen[rec.name] = rec
  end
  for _, rec in pairs(seen) do
    deduped[#deduped + 1] = rec
  end
  table.sort(deduped, function(a, b) return a.name < b.name end)
  return deduped
end

-- ── Renderers ────────────────────────────────────────────────────────────────

local function renderOx(records)
  local lines = {}
  for i = 1, #records do
    local r = records[i]
    lines[#lines + 1] = ("[%s] = {"):format(luaString(r.name))
    lines[#lines + 1] = ("  ['name'] = %s,"):format(luaString(r.name))
    lines[#lines + 1] = ("  ['label'] = %s,"):format(luaString(r.label))
    lines[#lines + 1] = ("  ['weight'] = %d,"):format(math.floor(tonumber(r.weight) or 0))
    if r.description and r.description ~= '' then
      lines[#lines + 1] = ("  ['description'] = %s,"):format(luaString(r.description))
    end
    if r.stack == false then
      lines[#lines + 1] = "  ['stack'] = false,"
    end
    if r.image then
      lines[#lines + 1] = ("  ['client'] = { ['image'] = %s },"):format(luaString(r.image))
    end
    lines[#lines + 1] = "},"
    lines[#lines + 1] = ""
  end
  return table.concat(lines, '\n')
end

local function renderQb(records)
  local lines = {}
  for i = 1, #records do
    local r = records[i]
    lines[#lines + 1] = ("[%s] = {"):format(luaString(r.name))
    lines[#lines + 1] = ("  ['name'] = %s,"):format(luaString(r.name))
    lines[#lines + 1] = ("  ['label'] = %s,"):format(luaString(r.label))
    lines[#lines + 1] = ("  ['weight'] = %d,"):format(math.floor(tonumber(r.weight) or 0))
    if r.description and r.description ~= '' then
      lines[#lines + 1] = ("  ['description'] = %s,"):format(luaString(r.description))
    end
    if r.useable     then lines[#lines + 1] = "  ['useable'] = true," end
    if r.shouldClose then lines[#lines + 1] = "  ['shouldClose'] = true," end
    if r.unique      then lines[#lines + 1] = "  ['unique'] = true," end
    if r.image then
      lines[#lines + 1] = ("  ['image'] = %s,"):format(luaString(r.image))
    end
    lines[#lines + 1] = "},"
    lines[#lines + 1] = ""
  end
  return table.concat(lines, '\n')
end

local function renderEsxSql(records)
  if #records == 0 then return '' end
  local rows = {}
  for i = 1, #records do
    local r = records[i]
    rows[#rows + 1] = ("(%s, %s, %d)"):format(
      sqlString(r.name),
      sqlString(r.label),
      math.floor(tonumber(r.weight) or 0)
    )
  end
  return "INSERT INTO `items` (`name`, `label`, `weight`) VALUES\n" ..
         table.concat(rows, ',\n') .. ';\n'
end

-- ── Public API ───────────────────────────────────────────────────────────────

local lastFingerprint = nil
local function fingerprint(records)
  -- Cheap stable string of the records list to skip rewrites when nothing changed.
  local parts = {}
  for i = 1, #records do
    local r = records[i]
    parts[i] = table.concat({
      r.name, r.label, tostring(r.weight), r.description or '',
      tostring(r.useable), tostring(r.shouldClose), tostring(r.unique),
      tostring(r.stack), r.image or '',
    }, '|')
  end
  return table.concat(parts, '\n')
end

local M = {}

function M.regenerate(schema, scriptConfig)
  if type(schema) ~= 'table' or type(scriptConfig) ~= 'table' then return end
  local records = collectInstallItems(schema, scriptConfig)
  local fp = fingerprint(records)
  if fp == lastFingerprint then return end
  lastFingerprint = fp

  local resourceName = GetCurrentResourceName()
  SaveResourceFile(resourceName, 'INSTALLATION/itemsToAdd/ox.lua',  renderOx(records),     -1)
  SaveResourceFile(resourceName, 'INSTALLATION/itemsToAdd/qb.lua',  renderQb(records),     -1)
  SaveResourceFile(resourceName, 'INSTALLATION/itemsToAdd/esx.sql', renderEsxSql(records), -1)
end

function M.collect(schema, scriptConfig)
  return collectInstallItems(schema, scriptConfig)
end

--- Audit: walks schema annotations, finds item names whose values aren't
--- registered in `lib.inventory.items()`, and returns:
---   {
---     missing  = { 'fish_knife', 'anchor', ... },          -- list of names
---     snippets = { ox = '...', qb = '...', esx = '...' }   -- rendered
---                                                            install blocks for ONLY
---                                                            the missing items
---   }
--- Used by the per-resource `<scriptName>:getMissingItems` callback to feed
--- the admin panel's MissingItemsBanner.
function M.audit(schema, scriptConfig)
  local all = collectInstallItems(schema, scriptConfig)
  local missing = {}
  for i = 1, #all do
    local rec = all[i]
    if not lib.inventory or type(lib.inventory.item) ~= 'function' or not lib.inventory.item(rec.name) then
      missing[#missing + 1] = rec
    end
  end
  return {
    missing  = missing,
    snippets = {
      ox  = renderOx(missing),
      qb  = renderQb(missing),
      esx = renderEsxSql(missing),
    },
  }
end

--- Console-friendly audit summary. Lists the missing names (capped at 5,
--- with "... and N more" tail), points the server owner at the freshly-
--- regenerated INSTALLATION/itemsToAdd/* files for ready-to-paste blocks.
--- Silent when nothing is missing.
---
--- FiveM already prefixes `print` output with `[script:<resource>]` so the
--- message itself doesn't repeat the resource name.
---
--- Deferred from the scriptConfig load by the caller because the inventory
--- bridge usually isn't fully wired up the moment scriptConfig finishes
--- loading — running the audit too eagerly would falsely report every item
--- as missing.
function M.logAuditWarning(schema, scriptConfig)
  local result = M.audit(schema, scriptConfig)
  local missing = result.missing
  if #missing == 0 then return end

  local PREVIEW = 5
  local names = {}
  for i = 1, math.min(PREVIEW, #missing) do
    names[#names + 1] = missing[i].name
  end
  local tail = (#missing > PREVIEW) and (' and ' .. (#missing - PREVIEW) .. ' more') or ''

  lib.print.warn(('%d item%s missing from your inventory: %s%s. See INSTALLATION/itemsToAdd/{ox.lua,qb.lua,esx.sql} (in this resource) for the install snippets — or open the admin panel and copy from the missing-items banner.'):format(
    #missing,
    #missing == 1 and '' or 's',
    table.concat(names, ', '),
    tail
  ))
end

return M
