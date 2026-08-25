-- Sending log lines on to Discord, as well as keeping them.
--
-- Not instead of the local table - as WELL as. Every line still lands in
-- `dirk_logs`, which is what the panel reads; a route is an extra destination
-- for the subset someone wants to see in a channel.
--
-- This replaces the per-script version of the same idea. Every script used to
-- carry its own webhook URL and its own list of event toggles, which meant the
-- same feature written N times, configured N times, and rate-limited N times -
-- each script cheerfully firing its own POSTs at Discord with no idea the
-- others existed.
--
-- The part that actually needed care is the sending. Discord's webhook limits
-- are per URL and unforgiving, and a busy night's fishing is not a trickle: it
-- is fifty catches in a few seconds. So nothing is posted immediately. Each
-- webhook has one queue, one in-flight request, and up to ten embeds per
-- message - which is Discord's own maximum, and turns that fifty into five
-- posts rather than fifty.

local routes = {}

--- Discord's cap: ten embeds in one webhook message.
local EMBEDS_PER_POST = 10
--- How long a line waits for company before being sent. Long enough to gather
--- a burst, short enough that a quiet channel still feels live.
local BATCH_MS = 2000
--- A queue that grows past this is dropping the oldest. A webhook that cannot
--- keep up must not become a memory leak.
local MAX_QUEUED = 500

local LEVEL_COLOR = {
  info  = 0x4AB569,
  warn  = 0xE0B15F,
  error = 0xE74C3C,
}

local config = {}
--- url -> { embeds = {}, sending = bool, timer = bool, dropped = n }
local queues = {}

--- Does this line belong in this route?
---
--- An empty filter means "any", so a route with none at all forwards
--- everything. That is deliberate: the common first route is "send me the
--- lot", and it should not require listing every resource on the server.
local function matches(route, resource, event, level)
  local function has(list, value)
    if type(list) ~= 'table' or #list == 0 then return true end
    for i = 1, #list do
      if list[i] == value then return true end
    end
    return false
  end

  return has(route.resources, resource)
    and has(route.events, event)
    and has(route.levels, level or 'info')
end

--- One log line, as a Discord embed.
local function embedFor(resource, event, message, level, player)
  local fields = {
    { name = 'Resource', value = ('`%s`'):format(resource), inline = true },
    { name = 'Event',    value = ('`%s`'):format(event),    inline = true },
  }

  if player and player.name then
    fields[#fields + 1] = {
      name = 'Player',
      value = player.identifier
        and ('%s\n`%s`'):format(player.name, player.identifier)
        or player.name,
      inline = false,
    }
  end

  return {
    title = event,
    description = message,
    color = LEVEL_COLOR[level or 'info'] or LEVEL_COLOR.info,
    fields = fields,
    footer = { text = os.date('%Y-%m-%d %H:%M:%S') },
  }
end

--- Send what is queued for one webhook, ten at a time.
---
--- One request in flight per URL. Discord's limit is per webhook, so firing
--- the next batch before the last has answered is exactly how a burst turns
--- into a 429 storm - and `sendWebhook` retries a 429, which without this
--- would multiply the problem rather than contain it.
local function drain(url)
  local queue = queues[url]
  if not queue or queue.sending or #queue.embeds == 0 then return end

  queue.sending = true

  local batch = {}
  for _ = 1, math.min(EMBEDS_PER_POST, #queue.embeds) do
    batch[#batch + 1] = table.remove(queue.embeds, 1)
  end

  local dropped = queue.dropped
  queue.dropped = 0

  local payload = { embeds = batch }
  if dropped > 0 then
    -- Say so rather than quietly losing them. A channel that silently skips
    -- lines is worse than one that admits it could not keep up.
    payload.content = ('_%d earlier line%s dropped - this webhook is behind._')
      :format(dropped, dropped == 1 and '' or 's')
  end

  lib.discord.sendWebhook(url, payload)

  -- A beat before the next batch, whatever the response was. sendWebhook is
  -- fire-and-forget with its own 429 handling, so this is a floor on our own
  -- rate rather than a reaction to theirs.
  SetTimeout(1200, function()
    queue.sending = false
    if #queue.embeds > 0 then drain(url) end
  end)
end

--- Queue one line for one webhook.
local function enqueue(url, embed)
  local queue = queues[url]
  if not queue then
    queue = { embeds = {}, sending = false, timer = false, dropped = 0 }
    queues[url] = queue
  end

  queue.embeds[#queue.embeds + 1] = embed

  -- Oldest first, because the newest lines are the ones someone is watching
  -- for. A queue this deep means the webhook is broken or throttled anyway.
  while #queue.embeds > MAX_QUEUED do
    table.remove(queue.embeds, 1)
    queue.dropped = queue.dropped + 1
  end

  if not queue.timer then
    queue.timer = true
    SetTimeout(BATCH_MS, function()
      queue.timer = false
      drain(url)
    end)
  end
end

--- Forward one log line to every route that wants it.
---
--- Called on the emit path, so it does no work at all when nothing is
--- configured - which is the common case and must stay free.
function routes.forward(resource, event, message, level, player)
  local list = config.routes
  if type(list) ~= 'table' or #list == 0 then return end

  local embed
  for i = 1, #list do
    local route = list[i]
    if route.enabled ~= false
      and type(route.url) == 'string' and route.url ~= ''
      and matches(route, resource, event, level)
    then
      -- Built once, and only if something actually matched.
      embed = embed or embedFor(resource, event, message, level, player)
      enqueue(route.url, embed)
    end
  end
end

function routes.configure(next)
  config.routes = type(next) == 'table' and next or {}
end

function routes.count()
  local n = 0
  for i = 1, #(config.routes or {}) do
    if config.routes[i].enabled ~= false then n = n + 1 end
  end
  return n
end

--- Is anything at all going to receive a line for this resource?
---
--- Used by `isConfigured`, so a consumer can skip building a payload nobody
--- wants. A route with no resource filter matches everything, so this is a
--- cheap yes in the common "forward the lot" case.
function routes.wants(resource)
  local list = config.routes
  if type(list) ~= 'table' then return false end
  for i = 1, #list do
    local route = list[i]
    -- Only the RESOURCE filter, deliberately. This asks "could anything from
    -- this script ever be forwarded", and passing a nil event through the
    -- full match would fail any route that names specific events - which is
    -- exactly the route most likely to want this resource.
    local list_ = route.resources
    local resourceOk = type(list_) ~= 'table' or #list_ == 0
    if not resourceOk then
      for j = 1, #list_ do
        if list_[j] == resource then resourceOk = true break end
      end
    end

    if route.enabled ~= false and type(route.url) == 'string' and route.url ~= ''
      and resourceOk
    then
      return true
    end
  end
  return false
end

return routes
