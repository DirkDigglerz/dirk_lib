-- lib.doorlock (server-side) — runtime door registration + auth bridge.
--
-- The existing client-side lib.doorlock only handles set/toggle/get-lock by
-- id on a door that already exists in the underlying script's config. This
-- server module adds the missing pieces: register a door from scratch
-- (model + coords + heading), set per-player auth rules, and clean up
-- automatically when the consumer resource stops.
--
-- Backend support varies. ox_doorlock supports everything natively. Other
-- bridges fall back to "manual mode" — the consumer must pre-add the door
-- in the doorlock script's config and pass that id as `externalId`; we'll
-- still mediate setLocked/setAuth calls but won't create the door for them.
--
-- ── API ─────────────────────────────────────────────────────────────────
--   lib.doorlock.register(spec)   -- create / claim a door
--   lib.doorlock.setLocked(id, locked)
--   lib.doorlock.setAuth(id, auth)
--   lib.doorlock.unregister(id)
--   lib.doorlock.list()
--
-- ── Spec shape ──────────────────────────────────────────────────────────
--   {
--     id          = 'druglabs:cocaine_door_42',  -- required, namespace it
--     coords      = vec3(...),                   -- required (vec3 or {x,y,z})
--     heading     = 180.0,                       -- optional, defaults 0
--     model       = `prop_door_01`,              -- model hash or string
--     locked      = true,                        -- initial state, default true
--     externalId  = nil,                         -- already-existing id for
--                                                -- backends that can't add
--                                                -- doors at runtime
--     auth        = {
--       groups     = { 'police' },               -- job/gang names
--       items      = { 'lab_key' },              -- inventory items
--       citizenIds = { 'ABC12345' },             -- specific player ids
--     },
--   }
--
-- Returns the door id on success, or nil on failure.

local settings        = lib.settings
local doorlockChoice  = settings.doorlock
local bridge

if doorlockChoice and doorlockChoice ~= 'NOT FOUND' and doorlockChoice ~= 'none' then
  bridge = lib.loadBridge('doorlock', doorlockChoice, 'server')
end

-- Registry of every door this lib has registered, keyed by id. Used for
-- list()/inspection and for the per-resource cleanup map below.
local doors = {}                   -- doors[id] = spec
local byResource = {}              -- byResource[resourceName] = { [id]=true }

local function normaliseCoords(c)
  if type(c) ~= 'vector3' and type(c) ~= 'table' then return nil end
  if type(c) == 'vector3' then return vec3(c.x, c.y, c.z) end
  if c.x and c.y and c.z then return vec3(c.x, c.y, c.z) end
  return nil
end

local function noBridgeWarn(call)
  lib.print.warn(('[lib.doorlock.%s] no doorlock backend loaded — install ox_doorlock / qb-doorlock / nui_doorlock, or remove the call'):format(call))
end

lib.doorlock = lib.doorlock or {}

-- Register a door at runtime. The bridge decides whether it creates the
-- door in its backend or just claims an externalId. Returns the id (string)
-- on success or nil on failure.
lib.doorlock.register = function(spec)
  if type(spec) ~= 'table' then return nil end
  if type(spec.id) ~= 'string' or spec.id == '' then
    lib.print.warn('[lib.doorlock.register] spec.id (string) is required')
    return nil
  end
  if doors[spec.id] then
    lib.print.warn(('[lib.doorlock.register] door %s already registered'):format(spec.id))
    return spec.id
  end
  local coords = normaliseCoords(spec.coords)
  if not coords and not spec.externalId then
    lib.print.warn(('[lib.doorlock.register] %s needs either coords or externalId'):format(spec.id))
    return nil
  end

  -- Normalised spec stored in our registry. Bridge may also stash its own
  -- backend id under spec._backendId for setLocked/unregister.
  local stored = {
    id         = spec.id,
    coords     = coords,
    heading    = tonumber(spec.heading) or 0.0,
    model      = spec.model,
    locked     = spec.locked ~= false,  -- default true
    externalId = spec.externalId,
    auth       = spec.auth,
    _resource  = GetInvokingResource() or 'dirk_lib',
  }

  if bridge and bridge.register then
    local ok, backendId = pcall(bridge.register, stored)
    if not ok then
      lib.print.warn(('[lib.doorlock.register] bridge errored on %s: %s'):format(spec.id, backendId))
      return nil
    end
    stored._backendId = backendId or stored.externalId
  else
    noBridgeWarn('register')
  end

  doors[stored.id] = stored
  byResource[stored._resource] = byResource[stored._resource] or {}
  byResource[stored._resource][stored.id] = true
  return stored.id
end

lib.doorlock.setLocked = function(id, locked)
  local door = doors[id]
  if not door then
    lib.print.warn(('[lib.doorlock.setLocked] unknown door %s'):format(tostring(id)))
    return
  end
  door.locked = locked and true or false
  if bridge and bridge.setLocked then
    pcall(bridge.setLocked, door, door.locked)
  else
    noBridgeWarn('setLocked')
  end
end

lib.doorlock.setAuth = function(id, auth)
  local door = doors[id]
  if not door then
    lib.print.warn(('[lib.doorlock.setAuth] unknown door %s'):format(tostring(id)))
    return
  end
  door.auth = type(auth) == 'table' and auth or nil
  if bridge and bridge.setAuth then
    pcall(bridge.setAuth, door, door.auth)
  else
    noBridgeWarn('setAuth')
  end
end

lib.doorlock.unregister = function(id)
  local door = doors[id]
  if not door then return end
  if bridge and bridge.unregister then
    pcall(bridge.unregister, door)
  end
  if byResource[door._resource] then
    byResource[door._resource][id] = nil
  end
  doors[id] = nil
end

-- Shallow inspection list. Returned table is freshly built per call so
-- callers can iterate without worrying about mid-iteration churn.
lib.doorlock.list = function()
  local out = {}
  for id, d in pairs(doors) do
    out[#out + 1] = {
      id         = id,
      coords     = d.coords,
      heading    = d.heading,
      model      = d.model,
      locked     = d.locked,
      externalId = d.externalId,
      auth       = d.auth,
      resource   = d._resource,
    }
  end
  return out
end

-- Auto-cleanup. When a consumer resource stops, drop every door it
-- registered. Without this, ox_doorlock would keep its in-memory door
-- entries until the next dirk_lib restart, leaking config across reloads
-- of the consumer.
AddEventHandler('onResourceStop', function(resourceName)
  if not byResource[resourceName] then return end
  for id in pairs(byResource[resourceName]) do
    lib.doorlock.unregister(id)
  end
  byResource[resourceName] = nil
end)

-- Read-only inspection from clients. Backs lib.doorlock.list() on the
-- client side. No mutation callbacks exposed — mutations are server-only
-- by design, consumers run their own auth and call the API directly.
lib.callback.register('dirk_lib:doorlock:list', function(_src)
  return lib.doorlock.list()
end)

return lib.doorlock
