return {
  getSkin = function(src)
    src = type(src) == 'string' and src or lib.player.identifier(src)
    return exports["rcore_clothing"]:getSkinByIdentifier(src)
  end
}