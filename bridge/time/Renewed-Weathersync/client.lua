-- Renewed-Weathersync exposes per-player sync control via the `syncWeather`
-- statebag on LocalPlayer.state. Setting it to false makes Renewed stop
-- applying server-pushed time/weather to this client — letting consumers
-- (e.g. multichar's selection scene) freely call NetworkOverrideClockTime
-- without being overwritten.
--
-- ── The init-race we work around ──────────────────────────────────────────
-- Renewed's weather.lua has an unconditional init thread:
--
--   CreateThread(function()
--     while not NetworkIsSessionStarted() do Wait(100) end
--     setWeather(true)
--     playerState.syncWeather = true          -- one-shot, every session start
--     ...
--   end)
--
-- A consumer that flips syncWeather to false BEFORE that thread runs (which
-- is easy — most "stop sync during my UI" callers also gate on
-- NetworkIsSessionStarted) will see Renewed clobber their disable a moment
-- later, then resume applying server `currentTime` every game-minute. Result:
-- the consumer's clock override loses the race ~every other frame.
--
-- We avoid the race entirely: before flipping syncWeather to false we wait
-- for Renewed's init thread to have set it to true at least once. Once we
-- write false AFTER that, nothing in Renewed flips it back to true during a
-- normal session (`QBCore:Client:OnPlayerLoaded` does, but that fires only
-- when the player picks a character — long after our UI scene closes and
-- the consumer has already called syncTime(true) to restore sync).
local renewedInitDone = false
CreateThread(function()
  while LocalPlayer.state.syncWeather ~= true do
    Wait(100)
  end
  renewedInitDone = true
end)

return {
  syncTime = function(state)
    if state == false then
      -- Wait for Renewed's init thread to fire its one-shot syncWeather=true
      -- before we disable. Bounded so we never hang if Renewed-Weathersync
      -- has been removed or doesn't start (in which case there's nothing to
      -- fight us anyway).
      local timeout = GetGameTimer() + 5000
      while not renewedInitDone and GetGameTimer() < timeout do
        Wait(50)
      end
    end

    LocalPlayer.state.syncWeather = state

    if state == false then
      -- Renewed's own AddStateBagChangeHandler reacts to syncWeather=false by
      -- calling NetworkOverrideClockTime(21, 0, 0) and freezing the clock.
      -- Statebag handlers run async (next frame), so a caller that immediately
      -- follows syncTime(false) with their own NetworkOverrideClockTime would
      -- be overwritten by Renewed's reaction. Brief wait lets Renewed's
      -- handler land first, so the caller's override is the final write.
      Wait(50)
    end

    return true
  end,
}
