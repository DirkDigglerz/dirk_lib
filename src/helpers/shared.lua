-- Build a fully-qualified item image URL from `name` using lib.settings.itemImgPath.
-- Honours an existing extension on `name` (so "fish_knife.webp" stays .webp) and
-- avoids the //double-slash that breaks CDN setups when itemImgPath ends in `/`.
lib.formatImagePath = function(name)
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
