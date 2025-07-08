local createValidation = function(value)
  local self = { value = value }

  self.string = function(len)
    if type(value) ~= 'string' then error('Expected string, got ' .. type(value)) end
    if len and #value > len then error('String exceeds max length ' .. len) end
    self.type = 'string'
    return self
  end

  self.number = function()
    if type(value) ~= 'number' then error('Expected number, got ' .. type(value)) end
    self.type = 'number'
    return self
  end

  self.boolean = function()
    if type(value) ~= 'boolean' then error('Expected boolean, got ' .. type(value)) end
    self.type = 'boolean'
    return self
  end

  self.min = function(min)
    if self.type == 'string' and #value < min then
      error('String shorter than min length ' .. min)
    elseif self.type == 'number' and value < min then
      error('Number less than min value ' .. min)
    end
    return self
  end

  self.max = function(max)
    if self.type == 'string' and #value > max then
      error('String longer than max length ' .. max)
    elseif self.type == 'number' and value > max then
      error('Number greater than max value ' .. max)
    end
    return self
  end

  self.refine = function(fn, err)
    if not fn(value) then
      error(err or 'Refinement check failed')
    end
    return self
  end

  self.default = function(defaultValue)
    if value == nil then
      value = defaultValue
      self.value = defaultValue
    end
    return self
  end

  self.done = function()
    return value
  end

  -- Metatable for nicer tostring behavior
  return setmetatable(self, {
    __tostring = function()
      return tostring(value)
    end,
    __call = function(_, ...)
      -- Optionally support calling the object to get value
      return value
    end,
  })
end

local validate = function(value)
  return createValidation(value)
end

-- Usage:
local val = validate("hello world").string().min(3).max(20)
print(val)        -- prints "hello world"
print(type(val))  -- "table"
local raw = val.done()  -- explicit raw value extraction
print(raw)        -- prints "hello world"
local called = val()  -- use __call to get raw value too
print(called)     -- prints "hello world"
