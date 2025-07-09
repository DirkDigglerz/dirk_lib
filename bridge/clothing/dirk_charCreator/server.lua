return {
  getSkin = function(src)
    src = type(src) == 'string' and src or lib.player.identifier(src)

  end
}