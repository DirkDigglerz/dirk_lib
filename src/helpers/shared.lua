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
