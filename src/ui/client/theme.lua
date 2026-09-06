-- ─────────────────────────────────────────────────────────────────────────────
-- Which colours each resource wears.
--
-- dirk_lib draws every shared UI on ITS OWN page, inside its own provider. So
-- until now everything on it wore dirk_lib's theme: a dialogue opened by a
-- resource with its own palette came up in dirk_lib's green regardless.
--
-- The fix is not to repaint the page. Two resources can have something on
-- screen at the same time — a fishing notification over a projectCars
-- dialogue — so the theme belongs to the ELEMENT, not the page. Every shared
-- element ships the calling resource's theme with its payload and the
-- component scopes itself to it.
--
-- ── how it gets here ────────────────────────────────────────────────────────
--
-- Pushed, never fetched. `modules/scriptConfig/client.lua` runs inside every
-- CONSUMER's VM, so it is the only code that ever sees another resource's
-- config; it calls `registerTheme` whenever that config is applied. That covers
-- the first hydration and every later edit through the panel, so this map is
-- always current without a callback, a poll, or anything on the hot path.
--
-- A resource with no `theme` block never registers, so it has no entry and
-- falls back to dirk_lib's global appearance. That is what every resource does
-- today, so nothing changes for them.
-- ─────────────────────────────────────────────────────────────────────────────

local themes = {}

--- Record a resource's theme. Called from a consumer's VM via the export.
---
--- @param resource string
--- @param theme table|nil  { useOverride, primaryColor, primaryShade, customTheme }
lib.registerTheme = function(resource, theme)
  if type(resource) ~= 'string' then return end
  themes[resource] = type(theme) == 'table' and theme or nil
end

--- The theme a given resource's UI should be drawn in, or nil for dirk_lib's.
---
--- `useOverride` off is the same answer as no theme at all: the resource has a
--- block but has chosen not to use it, so it takes the global appearance like
--- everything else.
---
--- @param resource string|nil
--- @return table|nil
lib.themeFor = function(resource)
  if not resource or resource == cache.resource then return nil end

  local theme = themes[resource]
  if not theme or theme.useOverride ~= true then return nil end

  return {
    primaryColor = theme.primaryColor,
    primaryShade = theme.primaryShade,
    customTheme  = theme.customTheme,
  }
end

--- The theme to ship with a UI payload, for whoever is calling right now.
---
--- Every shared element sends this. It has to be resolved AT SEND TIME rather
--- than when the element was registered, so an admin changing a theme while
--- something is on screen is reflected on its next update.
---
--- Call it from the entry point itself — `GetInvokingResource` only answers for
--- the frame that crossed the export boundary, so passing it down through a
--- helper first would lose it.
---
--- @param resource string|nil  usually GetInvokingResource() or GetCurrentResourceName()
lib.uiTheme = function(resource)
  return lib.themeFor(resource)
end

--- dirk_lib's own colours, for a caller that wants to match them by hand.
lib.getTheme = function()
  return {
    primaryColor   = settings.primaryColor,
    secondaryColor = settings.secondaryColor,
    logo           = settings.logo,
  }
end
