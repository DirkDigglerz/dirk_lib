-- --------------------------------------------------
-- INSTALL FILE GENERATOR
-- --------------------------------------------------
-- Walks the consumer's schema for `x-installItem` (scalar fields holding a
-- single item name) and `x-installItemList` (arrays where each entry IS an
-- item record) annotations, builds a unified item-records list, and writes
-- ready-to-paste installation files into the consumer's resource folder —
-- ONE FILE PER SUPPORTED INVENTORY so a server owner just opens the file named
-- after the inventory they run:
--
--   INSTALLATION/itemsToAdd/ox_inventory.lua, qb-inventory.lua, qs-inventory.lua,
--   codem-inventory.lua, tgiann-inventory.lua, one_inventory.lua,
--   ak47_inventory.lua, core_inventory.lua, devix-inventory.lua,
--   dirk_inventory.lua, bp_inventory.lua, esx.sql
--
-- Auto-fires on every scriptConfig load + change, so editing labels in the
-- admin updates the install files automatically. The same annotations + the
-- same per-inventory renderers drive the missing-items audit, so the admin
-- panel's banner shows a ready block in the owner's exact inventory format —
-- no translating between item schemas.
--
-- The one axis that actually differs between inventories is where the icon
-- lives, captured by the INVENTORIES registry:
--   * ox_inventory / bp_inventory → nested `client = { image = ... }`
--   * qb / qs / codem / tgiann / one / devix / dirk / core → top-level `image`
--   * ak47_inventory → NAME-BASED: no image field, the PNG is simply <item>.png
--   * core_inventory additionally needs per-item grid `x` / `y` / `category`
--   * ESX legacy items live in a DB table, not a Lua table (SQL insert)
-- Name-based inventories can't share one icon across many items (e.g. auto
-- blueprints) — each needs its own <item>.png. Flagged in each file header.
--
-- Annotation shapes:
--
--   "x-installItem": { label, weight?, description?, useable?, shouldClose?,
--                      unique?, stack?, image? }
--     Goes on a string-typed schema field whose value IS the item name.
--
--   "x-installItemList": true | { nameField?, labelField?, descriptionField?,
--                                 weightField?, namePrefix?, nameSuffix?,
--                                 labelPrefix?, labelSuffix?, weight?,
--                                 imageField?, image?, useable?, shouldClose?,
--                                 unique?, stack? }
--     Goes on an array-typed schema field whose entries carry their own
--     name/label/etc. `namePrefix`/`nameSuffix` build a computed item id from a
--     field (e.g. blueprints: namePrefix "blueprint_", nameField "model" →
--     `blueprint_adder`); `labelPrefix`/`labelSuffix` do the same for the label
--     (e.g. labelSuffix " Blueprint"). `image` sets one shared icon for every
--     entry; `imageField` reads a per-entry icon; `weight` is a fixed fallback.

-- Lua-string render with backslash + quote escaping.
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

local function getAtPath(data, pathParts)
  local cur = data
  for i = 1, #pathParts do
    if type(cur) ~= 'table' then return nil end
    cur = cur[pathParts[i]]
  end
  return cur
end

-- Push a finalised item record into `out` if the name is a non-empty string.
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
    image       = type(record.image) == 'string' and record.image ~= '' and record.image or nil,
  }
end

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

  if type(schemaNode['$ref']) == 'string' then
    local resolved = resolveRef(rootSchema, schemaNode['$ref'])
    if resolved then schemaNode = resolved end
  end

  -- x-installItem on the current node (scalar single-item field)
  local installItem = schemaNode['x-installItem']
  if type(installItem) == 'table' then
    local name = getAtPath(data, pathParts)
    pushRecord(out, name, installItem)
  end

  -- x-installItemList on the current node (array of item records)
  local installList = schemaNode['x-installItemList']
  if installList ~= nil then
    local arr = getAtPath(data, pathParts)
    if type(arr) == 'table' then
      local cfg = type(installList) == 'table' and installList or {}
      local nameField        = cfg.nameField        or 'name'
      local labelField       = cfg.labelField       or 'label'
      local descriptionField = cfg.descriptionField or 'description'
      local weightField      = cfg.weightField      or 'weight'
      local namePrefix       = cfg.namePrefix       or ''
      local nameSuffix       = cfg.nameSuffix       or ''
      local labelPrefix      = cfg.labelPrefix      or ''
      local labelSuffix      = cfg.labelSuffix      or ''
      for i = 1, #arr do
        local entry = arr[i]
        if type(entry) == 'table' then
          local base = entry[nameField]
          if type(base) == 'string' and base ~= '' then
            -- weightField can resolve to a number or a table (use first element);
            -- fall back to the fixed cfg.weight (e.g. blueprints = 1).
            local rawWeight = entry[weightField]
            if type(rawWeight) == 'table' then rawWeight = rawWeight[1] end
            if rawWeight == nil then rawWeight = cfg.weight end
            local lbl = entry[labelField] or base
            pushRecord(out, namePrefix .. base .. nameSuffix, {
              label       = labelPrefix .. lbl .. labelSuffix,
              weight      = rawWeight,
              description = entry[descriptionField],
              useable     = cfg.useable,
              shouldClose = cfg.shouldClose,
              unique      = cfg.unique,
              stack       = cfg.stack,
              image       = (cfg.imageField and entry[cfg.imageField]) or cfg.image,
            })
          end
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

  -- Recurse into array items by iterating the actual data array.
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
  -- Dedupe by name — last writer wins (scalar override metadata is richer).
  local seen = {}
  for i = 1, #out do seen[out[i].name] = out[i] end
  local deduped = {}
  for _, rec in pairs(seen) do deduped[#deduped + 1] = rec end
  table.sort(deduped, function(a, b) return a.name < b.name end)
  return deduped
end

-- ── Renderers ────────────────────────────────────────────────────────────────

-- Parameterised Lua item-table renderer. `opts.image` = 'client' (ox/bp,
-- nested), 'top' (top-level `image`) or 'none' (name-based, no field).
-- `opts.grid` adds core_inventory's required x/y/category.
local function renderLua(records, opts)
  opts = opts or {}
  local lines = {}
  for i = 1, #records do
    local r = records[i]
    lines[#lines + 1] = ("[%s] = {"):format(luaString(r.name))
    lines[#lines + 1] = ("  name = %s,"):format(luaString(r.name))
    lines[#lines + 1] = ("  label = %s,"):format(luaString(r.label))
    lines[#lines + 1] = ("  weight = %d,"):format(math.floor(tonumber(r.weight) or 0))
    if opts.grid then
      lines[#lines + 1] = "  x = 1,"
      lines[#lines + 1] = "  y = 1,"
      lines[#lines + 1] = "  category = \"misc\","
    end
    if r.description and r.description ~= '' then
      lines[#lines + 1] = ("  description = %s,"):format(luaString(r.description))
    end
    if r.useable     then lines[#lines + 1] = "  useable = true," end
    if r.unique      then lines[#lines + 1] = "  unique = true," end
    if r.shouldClose then lines[#lines + 1] = "  shouldClose = true," end
    if r.stack == false then lines[#lines + 1] = "  stack = false," end
    if r.image then
      if opts.image == 'client' then
        lines[#lines + 1] = ("  client = { image = %s },"):format(luaString(r.image))
      elseif opts.image == 'top' then
        lines[#lines + 1] = ("  image = %s,"):format(luaString(r.image))
      end
      -- 'none' → name-based, no image field emitted
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
    rows[#rows + 1] = ("(%s, %s, %d)"):format(sqlString(r.name), sqlString(r.label), math.floor(tonumber(r.weight) or 0))
  end
  return "INSERT INTO `items` (`name`, `label`, `weight`) VALUES\n" .. table.concat(rows, ',\n') .. ';\n'
end

-- ── Inventory registry ───────────────────────────────────────────────────────
-- One entry per inventory our bridge supports. `render(records)` returns the
-- ready-to-paste body; `paste`/`images` populate the file header so the owner
-- knows where the items and PNGs go. `key` matches both the bridge resource
-- name (settings.inventory) AND the frontend banner's dropdown key.
local function lua(opts) return function(records) return renderLua(records, opts) end end

local INVENTORIES = {
  { key = 'ox_inventory',     file = 'ox_inventory.lua',     render = lua{ image = 'client' },            paste = 'ox_inventory/data/items.lua',                                             images = 'ox_inventory/web/images/' },
  { key = 'qb-inventory',     file = 'qb-inventory.lua',     render = lua{ image = 'top' },               paste = 'qb-core/shared/items.lua',                                                images = 'qb-inventory/html/images/' },
  { key = 'qs-inventory',     file = 'qs-inventory.lua',     render = lua{ image = 'top' },               paste = 'qs-inventory/shared/items.lua (or qb-core/shared/items.lua on QB)',        images = 'qs-inventory/html/images/' },
  { key = 'codem-inventory',  file = 'codem-inventory.lua',  render = lua{ image = 'top' },               paste = 'codem-inventory/shared/items.lua (or qb-core/shared/items.lua)',           images = 'codem-inventory/html/itemimages/' },
  { key = 'tgiann-inventory', file = 'tgiann-inventory.lua', render = lua{ image = 'top' },               paste = "tgiann-inventory's shared items lua",                                     images = 'the SEPARATE inventory_images resource (tgiann serves icons from there, not from tgiann-inventory)' },
  { key = 'one_inventory',    file = 'one_inventory.lua',    render = lua{ image = 'top' },               paste = 'one_inventory (DB-backed — import via its admin panel / CreateItems export)', images = 'one_inventory/web/images/' },
  { key = 'ak47_inventory',   file = 'ak47_inventory.lua',   render = lua{ image = 'none' },              paste = 'ak47_inventory/shared/items.lua',                                         images = 'ak47_inventory/web/build/images/  (name each PNG <item>.png — no image field)' },
  { key = 'core_inventory',   file = 'core_inventory.lua',   render = lua{ image = 'top', grid = true },  paste = "your framework's item source, with core's grid x/y/category on each item", images = 'core_inventory/html/img/' },
  { key = 'devix-inventory',  file = 'devix-inventory.lua',  render = lua{ image = 'top' },               paste = "devix_inventory's own item list (CONFIRM the path against your install)",  images = "devix_inventory's image folder — CONFIRM against your install (escrowed, no public docs)" },
  { key = 'dirk_inventory',   file = 'dirk_inventory.lua',   render = lua{ image = 'top' },               paste = "dirk_inventory's shared items lua",                                       images = 'dirk_inventory image folder' },
  { key = 'bp_inventory',     file = 'bp_inventory.lua',     render = lua{ image = 'client' },            paste = "bp_inventory's items file (ox_inventory-compatible format)",               images = "bp_inventory's own image folder (bp serves icons from its own resource, not ox_inventory)" },
  { key = 'esx',              file = 'esx.sql',              render = renderEsxSql,                       paste = 'run against your server database',                                        images = 'name each PNG <item>.png in your ESX inventory image folder' },
}

local function header(inv, resourceName)
  return table.concat({
    ('-- %s install items — auto-generated by dirk_lib from %s scriptConfig (do not hand-edit).'):format(inv.key, resourceName),
    ('-- Paste into: %s'):format(inv.paste),
    ('-- Item images: %s'):format(inv.images),
    '',
    '',
  }, '\n')
end

-- ── Public API ───────────────────────────────────────────────────────────────

local lastFingerprint = nil
local function fingerprint(records)
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
  for i = 1, #INVENTORIES do
    local inv = INVENTORIES[i]
    SaveResourceFile(resourceName, 'INSTALLATION/itemsToAdd/' .. inv.file, header(inv, resourceName) .. inv.render(records), -1)
  end
end

function M.collect(schema, scriptConfig)
  return collectInstallItems(schema, scriptConfig)
end

--- Audit: walks schema annotations, finds item names whose values aren't
--- registered in `lib.inventory.items()`, and returns:
---   { missing = { rec, ... }, snippets = { <inventoryKey> = '...', ... } }
--- `snippets` is keyed by every registry inventory key (ox_inventory,
--- qb-inventory, …, dirk_inventory, bp_inventory, esx). Feeds the admin panel's
--- MissingItemsBanner dropdown, which defaults to the server's own inventory.
function M.audit(schema, scriptConfig)
  local all = collectInstallItems(schema, scriptConfig)
  local missing = {}
  for i = 1, #all do
    local rec = all[i]
    if not lib.inventory or type(lib.inventory.item) ~= 'function' or not lib.inventory.item(rec.name) then
      missing[#missing + 1] = rec
    end
  end
  local snippets = {}
  for i = 1, #INVENTORIES do
    local inv = INVENTORIES[i]
    snippets[inv.key] = inv.render(missing)
  end
  return { missing = missing, snippets = snippets }
end

--- Console-friendly audit summary. Silent when nothing is missing.
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

  lib.print.warn(('%d item%s missing from your inventory: %s%s. See INSTALLATION/itemsToAdd/<your-inventory> (in this resource) for a ready-to-paste block — or open the admin panel and copy from the missing-items banner.'):format(
    #missing,
    #missing == 1 and '' or 's',
    table.concat(names, ', '),
    tail
  ))
end

return M
