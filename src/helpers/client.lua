-- initialize cache for base64s
local cachedBase64s = {}

lib.convertToBase64 = function(url)
  if cachedBase64s[url] then
    return cachedBase64s[url]
  end

  base64 = promise.new()
  SendNUIMessage({
    action = 'IMAGE_TO_BASE64',
    data = url
  })
  cachedBase64s[url] = Citizen.Await(base64)
  return cachedBase64s[url]
end

RegisterNuiCallback('IMAGE_TO_BASE64_RESULT', function(data, cb)
  if base64 then
    base64:resolve(data.base64)
    base64 = nil
  end
  cb('ok')
end)