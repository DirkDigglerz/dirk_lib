return {
  getSkin = function(src)
    src = type(src) == 'string' and src or lib.player.identifier(src)
    local skin = MySQL.query.await('SELECT * FROM playerskins WHERE citizenid = ? AND active = ?', { src, 1 })
    if not skin or not skin[1] then return {} end 
    local ret = json.decode(skin[1].skin) or {}
    ret.model = tonumber(skin[1].model)
    return ret
  end
}