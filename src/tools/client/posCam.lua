DevTool.register('camPos', {
  label = 'Camera Position',
  command = true, 
  description = 'Copy the current pos and rotation of the camera to your clipboard',
  icon = 'camera',
  action = function()
    local cam = GetRenderingCam()
    local pos = GetCamCoord(cam)
    local rot = GetCamRot(cam, 2)
    local stringToCopy = string.format("pos = vector3(%s,%s,%s),\n rot = vector3(%s,%s,%s)", pos.x, pos.y,pos.z, rot.x,rot.y,rot.z)
    lib.copyToClipboard(stringToCopy)
  end
})

