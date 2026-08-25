--- Resolves `x-autoDefault` in a schema.
---
--- `x-autoDefault` is a convar name (or a list of them); the first non-empty
--- value REPLACES that field's literal default. The point is that a fresh
--- install should already read right — a server-name field showing the
--- operator's actual server name beats a placeholder — while an admin who
--- edits it still wins, because an edit writes an override row and overrides
--- always sit on top of defaults.
---
--- Nothing is stored for a detected value, so renaming the server in
--- server.cfg keeps being followed until someone types over it.
---
--- Two callers, two needs. The scriptConfig engine holds a decoded schema and
--- wants the defaults corrected in place. The Script Studio sends the schema
--- to the panel as RAW TEXT (Lua tables have no key order, so decoding and
--- re-encoding would shuffle every section), and so wants a `path -> value`
--- map it can hand over alongside it. Passing `out` picks the second.

---@param schema table a decoded JSON Schema node
---@param path string? dot-path of this node, nil at the root
---@param out table? when given, collect into `out[path] = value` instead of writing schema.default
---@return table schema | table out
local function resolveAutoDefaults(schema, path, out)
  if type(schema) ~= 'table' then return out or schema end

  local sources = schema['x-autoDefault']
  if type(sources) == 'string' then sources = { sources } end
  if type(sources) == 'table' then
    for i = 1, #sources do
      local value = GetConvar(sources[i], '')
      if value and value ~= '' then
        -- sv_hostname is usually dressed in FiveM colour codes; a settings
        -- field wants the words, not the paint.
        value = value:gsub('%^%d', ''):gsub('~%a~', ''):gsub('^%s+', ''):gsub('%s+$', '')
        if value ~= '' then
          if out then
            if path then out[path] = value end
          else
            schema.default = value
          end
          break
        end
      end
    end
  end

  if schema.properties then
    for key, propSchema in pairs(schema.properties) do
      resolveAutoDefaults(propSchema, path and (path .. '.' .. key) or key, out)
    end
  end

  return out or schema
end

return resolveAutoDefaults
