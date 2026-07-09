-- Build a fully-qualified item image URL from `name` using lib.settings.itemImgPath.
-- Honours an existing extension on `name` (so "fish_knife.webp" stays .webp) and
-- avoids the //double-slash that breaks CDN setups when itemImgPath ends in `/`.
-- Defensive: a malformed/custom inventory item with no `name` field used to
-- crash here with "attempt to index a nil value" on the :match call. Now we
-- just return '' so the consumer renders a blank image instead of erroring.
lib.formatImagePath = function(name)
  if type(name) ~= 'string' or name == '' then return '' end
  -- An ox item's `client.image` may already be a fully-qualified image
  -- reference — a URL (http/https), an `nui://` path, a data URI, or an
  -- absolute path. Use those verbatim instead of prefixing the CDN base and
  -- `.png`, which would double-prefix and break the image. Bare item names
  -- (the common case) still resolve against lib.settings.itemImgPath below.
  if name:find('://', 1, true) or name:sub(1, 5) == 'data:' or name:sub(1, 1) == '/' then
    return name
  end
  local p = lib.settings.itemImgPath or ''
  local sep = (p == '' or p:sub(-1) == '/') and '' or '/'
  local ext = name:match('%.%w+$') and '' or '.png'
  return ('%s%s%s%s'):format(p, sep, name, ext)
end

lib.hasGroup = function(job, gang, groups)
  if not groups then return true; end
  if type(groups) == 'string' then
    return job?.name == groups or gang?.name == groups
  end

  if lib.table.isArray(groups) then
    return lib.table.includes(groups, job?.name) or lib.table.includes(groups, gang?.name)
  end

  for groupName, requiredGrade in pairs(groups) do
    if (job and job.name == groupName and job.grade >= requiredGrade) or
       (gang and gang.name == groupName and gang.grade >= requiredGrade) then
      return true
    end
  end
  return false
end
