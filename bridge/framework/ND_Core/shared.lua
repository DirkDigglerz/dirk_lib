--============================================================
-- ND_Core — shared
--
-- ND has no GetCoreObject(); it exposes every function as a plain export. Its
-- own init.lua builds a proxy table that turns `NDCore.foo(...)` into
-- `exports.ND_Core:foo(...)`, so we rebuild the same thing here rather than
-- depending on ND's file being loadable from our scope.
--
-- Built ONCE at module level: lib.FW calls getObject() on every index, so this
-- must not allocate per call.
--============================================================

local nd = exports['ND_Core']

local NDCore = setmetatable({}, {
  __index = function(self, index)
    self[index] = function(...)
      return nd[index](nil, ...)
    end
    return self[index]
  end,
})

return {
  getObject = function()
    return NDCore
  end,
}
