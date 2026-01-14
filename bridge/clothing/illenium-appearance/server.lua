return {
  getSkin = function(src)
    src = type(src) == 'string' and src or lib.player.identifier(src)
    local skin = exports.oxmysql:query_async('SELECT * FROM playerskins WHERE citizenid = ? AND active = ?', { src, 1 })
    print("Fetched skin from database:", json.encode(skin, { indent = true }))
    if not skin or not skin[1] then return {} end 
    local ret = json.decode(skin[1].skin) or {}
    print(json.encode(ret, { indent = true }))
    ret.model = skin[1].model or ret.model or 'mp_m_freemode_01'
    return ret
  end
}