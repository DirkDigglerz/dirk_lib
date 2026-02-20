local glm = require 'glm'

local sanitizePolyPoints = function(points)
  local fixedPoints = {}

  for i, pt in ipairs(points) do
    -- if it's vector2, force z = 0
    if pt.z == nil then
      fixedPoints[i] = vector3(pt.x, pt.y, 0.0)
    else
      fixedPoints[i] = pt
    end
  end

  return fixedPoints
end

lib.zones = {
  getCenter = function(poly)
    local x,y,z = 0,0,0
    for i=1,#poly do
      x = x + poly[i].x
      y = y + poly[i].y
      z = z + poly[i].z
    end
    return vector3(x/#poly,y/#poly,z/#poly)
  end,

  isPointInside = function(poly,pos, height)
    poly = sanitizePolyPoints(poly)
    pos = vector3(pos.x, pos.y, pos.z or 0)
    return glm.polygon.new(poly):contains(pos, height or 5.0)
  end
}

return lib.zones
