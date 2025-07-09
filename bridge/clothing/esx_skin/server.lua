return {
  getSkin = function(src)
    src = type(src) == 'string' and src or lib.player.identifier(src)
    local skin = exports.oxmysql:query_async('SELECT skin FROM users WHERE identifier LIKE ?', {'%'..src..'%'})
    if not skin or not skin[1] then return {} end 
    return skin
  end
}