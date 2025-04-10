-- Adapted from ox_lib (https://github.com/overextended/ox_lib/blob/master/imports/disableControls/client.lua)
-- Licensed under LGPL-3.0: https://www.gnu.org/licenses/lgpl-3.0.html

--- Call on frame to disable all stored keys.
--- ```
--- disableControls()
--- ```
local disableControls = {}

---@param ... number | table
function disableControls:Add(...)
	local keys = type(...) == 'table' and ... or {...}
	for i=1, #keys do
		local key = keys[i]
		if self[key] then
			self[key] += 1
		else
			self[key] = 1
		end
	end
end

---@param ... number | table
function disableControls:Remove(...)
	local keys = type(...) == 'table' and ... or {...}
	for i=1, #keys do
		local key = keys[i]
		local exists = self[key]
		if exists and exists > 1 then
			self[key] -= 1
		else
			self[key] = nil
		end
	end
end

---@param ... number | table
function disableControls:Clear(...)
	local keys = type(...) == 'table' and ... or {...}
	for i=1, #keys do
		self[keys[i]] = nil
	end
end

local keys = {}
local DisableControlAction = DisableControlAction
local pairs = pairs

lib.disableControls = setmetatable(disableControls, {
	__index = keys,
	__newindex = keys,
	__call = function()
		for k in pairs(keys) do
			DisableControlAction(0, k, true)
		end
	end
})

return lib.disableControls
