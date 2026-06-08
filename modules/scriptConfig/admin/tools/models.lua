-- Model validity admin tool.
--
-- Exposes:
--   lib.adminTool.validateModel(name) -> boolean
--     True if the given model name resolves to a streamable model in the
--     client's CD-image (i.e. CreateObject would actually succeed). Cached
--     per resource lifetime — every name only gets the native lookup once.
--
--   lib.adminTool.validateModels(names) -> { [name] = boolean }
--     Batch variant. Same cache as the single version.
--
-- NUI surface:
--   ADMIN_TOOL_QUERY { id = 'validateModels', value = { 'shell_a', 'shell_b' } }
--   → returns { shell_a = true, shell_b = false }
--
-- Used by dirk-cfx-react's useValidModels hook so admin panels can grey
-- out shell / prop rows whose model isn't loaded on this server, instead
-- of letting the admin click into a broken row and only finding out at
-- save time.

local cache = {}

local function checkOne(name)
  if type(name) ~= 'string' or name == '' then return false end
  local cached = cache[name]
  if cached ~= nil then return cached end
  local hash = type(name) == 'number' and name or GetHashKey(name)
  -- IsModelInCdimage covers the broadest case: any model the streamer
  -- knows about, props + peds + vehicles. IsModelValid is stricter
  -- (refuses null/inactive); IsModelInCdimage is what most prop tools
  -- check against because it's what CreateObject ultimately needs.
  local ok = IsModelInCdimage(hash) and true or false
  cache[name] = ok
  return ok
end

local function validateBatch(names)
  if type(names) ~= 'table' then return {} end
  local out = {}
  for i = 1, #names do
    local n = names[i]
    if type(n) == 'string' and n ~= '' then
      out[n] = checkOne(n)
    end
  end
  return out
end

lib.adminTool.validateModel = function(name)
  if not lib.adminTool.isEditing() then return false end
  return checkOne(name)
end

lib.adminTool.validateModels = function(names)
  if not lib.adminTool.isEditing() then return {} end
  return validateBatch(names)
end

lib.adminTool.register('validateModels', 'query', function(data)
  return validateBatch(data and data.value)
end)
