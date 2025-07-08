-- Only used by es_extended because they dont allow access to licenses client-side
lib.callback.register('dirk_lib:player:getLicenses', function(src)
  return lib.player.getLicenses(src)
end)

lib.callback.register('dirk_lib:player:hasLicense', function(src, license)
  return lib.player.hasLicense(src, license)
end)
