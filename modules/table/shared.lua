local valid_conversions = {
  'vectors',
  'items_sql',
  'string',
  'item_ox',
  'convert_indexes',
}



frozenNewIndex = function()
  error('Table is frozen and cannot be modified')
end

convert_indexes = function(tbl, new_indexing)
  for k,v in pairs(tbl) do
    local new_index = new_indexing[k]
    if new_index then 
      tbl[new_index] = tbl[k]
      tbl[k] = nil
    end
  end
  return tbl
end

getCount = function(tbl)
  local count = 0
  for _ in pairs(tbl) do count += 1 end
  return count
end


findKeyInTable = function(tbls, key)
  local findInTable = function(tbl, key)
    for _key, data in pairs(tbl) do
      if type(data) == 'table' then
        local found = findInTable(data, key)
        if found then return found; end
      else
        if _key == key then return data; end
      end
    end
    return false
  end

  for _, table in pairs(tbls) do
    for _key, data in pairs(table) do 
      if type(data) == 'table' then
        local found = findInTable(data, key)
        if found then return found; end
      else
        if _key == key then return data; end
      end      
    end
  end
  return false
end

deepClone = function(table)
  local cloned = {}
  for key, value in pairs(table) do
    if type(value) == "table" then
      cloned[key] = deepClone(value)  -- Recursive call for nested tables
    else
      cloned[key] = value  -- Copy non-table values directly
    end
  end
  return cloned
end

local convert_to_ox = function(table)
  local ret = {}
  for item,data in pairs(table) do
    ret[item] = {} 
    assert(data.label, "Label is required for item "..item)
    assert(data.name, "Name is required for item "..item)
    assert(data.name == item, "Name and key must be the same for item "..item)
    assert(type(data.label) == "string", "Label must be a string for item "..item)
    
    for k,v in pairs(data) do 
      if k == "label" or k == "weight" or k == "stackable" then 
        if k ~= "stackable" then 
          ret[item][k] = v
        else
          ret[item]["stack"] = v
        end
      elseif k == 'image' then 
        ret[item].client = {
          image = v
        }
      end
    end
  end
  return ret
end

local convert_to_string = function(table)
  local output = ""
  for k,v in pairs(table) do
    output = output.."['"..k.."']".." = {\n"
    for n,d in pairs(v) do
      if type(d) == "table" then
        output = output.."  ".."['"..n.."']".." = {\n"
          for i,m in pairs(d) do
            if type(m) == "boolean" then
              output = output.."    ".."['"..i.."']".." = "..tostring(m)..",\n"
            elseif type(m) == "number" then
              output = output.."    ".."['"..i.."']".." = "..m..",\n"
            else
              output = output.."    ".."['"..i.."']".." = '"..m.."',\n"
            end
          end
        output = output.."  },"
      elseif type(d) == "boolean" then
        output = output.."  ".."['"..n.."']".." = "..tostring(d)..","
      elseif type(d) == "number" then
        output = output.."  ".."['"..n.."']".." = "..d..","
      else
        output = output.."  ".."['"..n.."']".." = '"..d.."',"
      end
      output = output.."\n"
    end
    output = output.."\n},\n"
  end
  return output
end

local convert_to_vectors = function(table)
  local formattedTable = {}
  for key, value in pairs(table) do
    if type(value) == "table" and not value.x then
      formattedTable[key] = convert_to_vectors(value) -- Recursively call the function for nested tables
    else
      if type(value) == "table" and value.x and value.y and value.z and value.w then
        formattedTable[key] = vector4(value.x, value.y, value.z, value.w)
      elseif type(value) == "table" and value.x and value.y and value.z then
        formattedTable[key] = vector3(value.x, value.y, value.z)
      elseif type(value) == "table" and value.x and value.y then
        formattedTable[key] = vector2(value.x, value.y)
      else
        formattedTable[key] = value
      end
    end
  end
  return formattedTable
end

local convert_to_sql = function(table)
  local tableCount = tableCount(table)
  local output = "INSERT INTO `"..Config.ItemsDatabaseName.."` (`name`, `label`) VALUES"
  local currentNumber = 0
  for k,v in pairs(t) do
    assert(v.label, "Label is required for item "..k)
    assert(v.name, "Name is required for item "..k)
    assert(v.name == k, "Name and key must be the same for item "..k)
    assert(type(v.label) == "string", "Label must be a string for item "..k)
    currentNumber = currentNumber + 1
    output = output..string.format("\n ('%s', '%s')%s", k, v.label, currentNumber == tableCount and "" or ",")
  end
  output = output..";"
  return output
end

lib.table = {
  deepClone = deepClone,
  findKeyInTable = findKeyInTable,

  merge = function(t1, t2, addDuplicateNumbers)
    if addDuplicateNumbers == nil then addDuplicateNumbers = true end
    for k, v in pairs(t2) do
        local type1 = type(t1[k])
        local type2 = type(v)

		if type1 == 'table' and type2 == 'table' then
            table_merge(t1[k], v, addDuplicateNumbers)
        elseif addDuplicateNumbers and (type1 == 'number' and type2 == 'number') then
            t1[k] += v
		else
			t1[k] = v
        end
    end

    return t1
  end,

  includes = function(table, value)
    for k,v in pairs(table) do
      if v == value then return true; end
      if type(v) == 'table' then
        if lib.table.includes(v, value) then return true; end
      end
    end
    return false
  end,
  

  convert = function(_type, data)
    assert(_type, "Type is required for table conversion")
    assert(data, "Data is required for table conversion")
    assert(lib.table.includes(valid_conversions, _type), "Invalid conversion type")

    if _type == "vectors" then
      return convert_to_vectors(data)
    elseif _type == 'items_sql' then 
      return convert_to_sql(data)
    elseif _type == 'string' then 
      return convert_to_string(data)
    elseif _type == 'item_ox' then 
      return convert_to_ox(data)
    elseif _type == 'convert_indexes' then
      return convert_indexes(data)
    end
  end, 

  count = function(table)
    return getCount(table)
  end,

  wipe = function(tbl)
    for k in pairs(tbl) do
      tbl[k] = nil
    end
  end,

  freeze = function(tbl)
    local copy = deepClone(tbl)
    local metatable = getmetatable(tbl)

    table.wipe(tbl)
    setmetatable({}, {
      __index = metatable and setmetatable(copy, metatable) or copy,
      __metatable = 'readonly',
      __newindex = frozenNewIndex,
      __len = function() return #copy end,
      __pairs = function() return next, copy end,
    })

    return tbl
  end,

  compare = function(t1, t2)
    for k,v in pairs(t1) do 
      if type(v) == 'table' then
        if not lib.table.compare(v, t2[k]) then return false; end
      else
        if t2[k] ~= v then return false; end
      end
    end
    return true
  end,

  isArray = function(tbl)
    if type(tbl) ~= 'table' then return false; end
    for k,v in pairs(tbl) do 
      if type(k) ~= 'number' then return false; end
      if v == nil then return false; end
    end
    return true
  end,
}


return lib.table