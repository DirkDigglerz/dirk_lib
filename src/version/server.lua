--[[
    https://github.com/overextended/ox_lib

    This file is licensed under LGPL-3.0 or higher <https://www.gnu.org/licenses/lgpl-3.0.en.html>

    Copyright © 2025 Linden <https://github.com/thelindat>
]]

-- @param repository string  "owner/repo"
-- @param options? table
--    manifest?: boolean   if true, fetch from raw.githubusercontent.com/{repo}/{branch}/{path}
--                         and look up json[key] for the version string instead of hitting
--                         the GitHub Releases API. Lets you keep one public versions.json
--                         that tracks the version of many (including private) resources.
--    branch?:   string    manifest branch (default 'main')
--    path?:     string    manifest path (default 'versions.json')
--    key?:      string    manifest key (default = invoking resource name)
function lib.versionCheck(repository, options)
	local resource = GetInvokingResource() or GetCurrentResourceName()

	local currentVersion = GetResourceMetadata(resource, 'version', 0)

	if currentVersion then
		currentVersion = currentVersion:match('%d+%.%d+%.%d+')
	end

	if not currentVersion then return print(("^1Unable to determine current resource version for '%s' ^0"):format(resource)) end

	local manifestMode = options and options.manifest
	local branch       = options and options.branch or 'main'
	local path         = options and options.path or 'versions.json'
	local key          = options and options.key or resource

	local url, parseLatest, fallbackUrl
	if manifestMode then
		url = ('https://raw.githubusercontent.com/%s/%s/%s'):format(repository, branch, path)
		fallbackUrl = ('https://github.com/%s'):format(repository)
		parseLatest = function(response)
			local data = json.decode(response)
			if type(data) ~= 'table' then return end
			local v = data[key]
			if type(v) ~= 'string' then return end
			return v:match('%d+%.%d+%.%d+')
		end
	else
		url = ('https://api.github.com/repos/%s/releases/latest'):format(repository)
		parseLatest = function(response)
			local data = json.decode(response)
			if data.prerelease then return end
			fallbackUrl = data.html_url
			return data.tag_name and data.tag_name:match('%d+%.%d+%.%d+')
		end
	end

	SetTimeout(1000, function()
		PerformHttpRequest(url, function(status, response)
			if status ~= 200 then return end

			local latestVersion = parseLatest(response)
			if not latestVersion or latestVersion == currentVersion then return end

            local cv = { string.strsplit('.', currentVersion) }
            local lv = { string.strsplit('.', latestVersion) }

            for i = 1, #cv do
                local current, minimum = tonumber(cv[i]), tonumber(lv[i])

                if current ~= minimum then
                    if current < minimum then
                        return print(('^3An update is available for %s (current version: %s)\r\n%s^0'):format(resource, currentVersion, fallbackUrl or ''))
                    else break end
                end
            end
		end, 'GET')
	end)
end
