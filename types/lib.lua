---@meta

--[[
  dirk_lib type definitions.

  WHY THIS FILE EXISTS
  `lib` is built in init.lua as a table with an __index metamethod that loads
  modules/<name>/<context>.lua on first access. That is invisible to a language
  server: nothing in the source textually assigns lib.target, so without this
  file every lib.* call resolves to `unknown`, and none of the annotations
  already written across the modules can ever be reached.

  This file declares the SHAPE of lib and nothing else. It deliberately does
  not restate function signatures: those live on the functions themselves, and
  a second copy here would drift the first time one of them changed.

  The classes below are declared empty ON PURPOSE. LuaLS merges same-named
  @class declarations across files, so tagging a module's returned table with
  its matching class name fills the type in from the real source. That keeps
  one copy of the truth and lets the modules be done a few at a time.

  CONTEXT IS PART OF THE TYPE. Every field records whether the module exists on
  the client, the server or both. That is read off the filesystem rather than
  remembered, and it is the mistake that costs the most time: calling a
  server-only module on the client fails at runtime with nothing useful in the
  console.
]]

---@alias dirklib.context "client"|"server"

-- Module classes. Empty here; each module fills its own in once its returned
-- table carries the matching ---@class tag.
---@class dirklib.accounts
---@field [string] any
---@class dirklib.addCommand
---@field [string] any
---@class dirklib.addKeybind
---@field [string] any
---@class dirklib.await
---@field [string] any
---@class dirklib.blip
---@field [string] any
---@class dirklib.callback
---@field [string] any
---@class dirklib.class
---@field [string] any
---@class dirklib.closest
---@field [string] any
---@class dirklib.diag
---@field [string] any
---@class dirklib.disableControls
---@field [string] any
---@class dirklib.discord
---@field [string] any
---@class dirklib.dispatch
---@field [string] any
---@class dirklib.doorlock
---@field [string] any
---@class dirklib.dui
---@field [string] any
---@class dirklib.file
---@field [string] any
---@class dirklib.framework
---@field [string] any
---@class dirklib.game
---@field [string] any
---@class dirklib.garage
---@field [string] any
---@class dirklib.getCommandKey
---@field [string] any
---@class dirklib.gizmo
---@field [string] any
---@class dirklib.housing
---@field [string] any
---@class dirklib.interact
---@field [string] any
---@class dirklib.inventory
---@field [string] any
---@class dirklib.locale
---@field [string] any
---@class dirklib.logger
---@field [string] any
---@class dirklib.math
---@field [string] any
---@class dirklib.minigame
---@field [string] any
---@class dirklib.mission
---@field [string] any
---@class dirklib.money
---@field [string] any
---@class dirklib.objects
---@field [string] any
---@class dirklib.player
---@field [string] any
---@class dirklib.positionPicker
---@field [string] any
---@class dirklib.print
---@field [string] any
---@class dirklib.raycast
---@field [string] any
---@class dirklib.registerTebexHook
---@field [string] any
---@class dirklib.request
---@field [string] any
---@class dirklib.require
---@field [string] any
---@class dirklib.scenes
---@field [string] any
---@class dirklib.scriptConfig
---@field [string] any
---@class dirklib.string
---@field [string] any
---@class dirklib.table
---@field [string] any
---@class dirklib.target
---@field [string] any
---@class dirklib.test
---@field [string] any
---@class dirklib.validate
---@field [string] any
---@class dirklib.vehicle
---@field [string] any
---@class dirklib.zones
---@field [string] any

---@class dirklib
---@field name string The library resource name, always "dirk_lib".
---@field context dirklib.context Which side this copy is running on.
---@field settings table Live settings, resynced when an admin edits them.
---@field FW table The framework core object, resolved once then cached.
---@field accounts dirklib.accounts [server] Player accounts and balances.
---@field addCommand dirklib.addCommand [server] Register a chat command with argument parsing and ACL.
---@field addKeybind dirklib.addKeybind [client] Register a rebindable key, exposed in the game keybind menu.
---@field await dirklib.await [shared] Await helpers for promise-shaped values.
---@field blip dirklib.blip [client] Create, update and destroy map blips.
---@field callback dirklib.callback [client and server] Request/response between client and server. Note: no timeout argument.
---@field class dirklib.class [shared] Minimal OOP: classes, constructors and inheritance.
---@field closest dirklib.closest [shared] Find the nearest ped, player or object within a range.
---@field diag dirklib.diag [server] Runtime instrumentation and diagnostic dumps.
---@field disableControls dirklib.disableControls [client] Disable groups of game controls for a frame or a duration.
---@field discord dirklib.discord [server] Discord guild, member, role and webhook access.
---@field dispatch dirklib.dispatch [server] Send an alert to the configured dispatch resource.
---@field doorlock dirklib.doorlock [client and server] Register doors and drive their lock state.
---@field dui dirklib.dui [client] Offscreen browser surfaces rendered onto textures.
---@field file dirklib.file [server] Read and write files inside a resource.
---@field framework dirklib.framework [server] Framework-agnostic player and group lookups.
---@field game dirklib.game [client] Assorted game-state helpers.
---@field garage dirklib.garage [server] Vehicle storage through the garage or framework bridge.
---@field getCommandKey dirklib.getCommandKey [client] The key currently bound to a command.
---@field gizmo dirklib.gizmo [client] In-world translate, rotate and scale handles for placing things.
---@field housing dirklib.housing [client] Property and interior state through the housing bridge.
---@field interact dirklib.interact [client] Proximity interaction prompts.
---@field inventory dirklib.inventory [client and server] Items, stashes and inventory operations.
---@field locale dirklib.locale [shared] Translation lookup. Positional arguments use %s, in order.
---@field logger dirklib.logger [server] Structured logging to the configured sink.
---@field math dirklib.math [shared] Numeric helpers: clamp, lerp, rounding, colour and vector conversion.
---@field minigame dirklib.minigame [client] Run a minigame through whichever provider is configured.
---@field mission dirklib.mission [client and server] Multi-step missions with progress, reconnect handling and failure.
---@field money dirklib.money [server] Balances and change notifications.
---@field objects dirklib.objects [client] Networked props with enter, exit and inside callbacks.
---@field player dirklib.player [client and server] Player identity, online checks and customisation.
---@field positionPicker dirklib.positionPicker [client] Let a player pick a position or heading in-world.
---@field print dirklib.print [shared] Levelled printing with per-type conditions.
---@field raycast dirklib.raycast [client] Casts from camera, coords or screen, plus screen and world conversion.
---@field registerTebexHook dirklib.registerTebexHook [server] React to Tebex purchase, renewal and removal events.
---@field request dirklib.request [client] Await streamed assets: models, anim dicts, audio banks, textures.
---@field require dirklib.require [shared] Module loading. Overrides the global require.
---@field scenes dirklib.scenes [client] Synced scenes with peds and props. Release handles or they leak.
---@field scriptConfig dirklib.scriptConfig [client and server] Per-script settings, permissions and the admin settings UI.
---@field string dirklib.string [shared] String helpers.
---@field table dirklib.table [shared] Table helpers: compare, clone, count, convert.
---@field target dirklib.target [client] Third-eye targeting through whichever target resource is installed.
---@field test dirklib.test [client and server] Console test runner. Needs the dirk_lib 'test' manifest flag.
---@field validate dirklib.validate [shared] Chainable value validation and coercion.
---@field vehicle dirklib.vehicle [client and server] Plates, keys, fuel and class lookups.
---@field zones dirklib.zones [client and server] Poly, box and sphere zones with enter and exit callbacks.
---@field onCache fun(key: string, cb: fun(value: any)) Calls cb with the current value, then again on every change.
---@field loadBridge fun(kind: string, implementation: string, context: string): table Load a bridge implementation by name.

---The library itself. A global, set by init.lua.
---@type dirklib
lib = {}

---@class dirklib.cache
---@field resource string The resource this copy of lib is running in.
---@field game string The game name reported by the runtime.
---@field charName any [client] Cached player state, refreshed on change.
---@field citizenId any [client] Cached player state, refreshed on change.
---@field cuffed any [client] Cached player state, refreshed on change.
---@field dead any [client] Cached player state, refreshed on change.
---@field driver any [client] Cached player state, refreshed on change.
---@field gang any [client] Cached player state, refreshed on change.
---@field job any [client] Cached player state, refreshed on change.
---@field mount any [client] Cached player state, refreshed on change.
---@field ped any [client] Cached player state, refreshed on change.
---@field seat any [client] Cached player state, refreshed on change.
---@field vehicle any [client] Cached player state, refreshed on change.
---@field weapon any [client] Cached player state, refreshed on change.
---@field playerLoaded any [client] Cached player state, refreshed on change.

--[[
  Cached player state. Reading a key subscribes to its change event, so the
  value stays current without anything having to poll for it.

  Also callable as cache(key, fn, timeout) to memoise fn under key, optionally
  expiring the entry after timeout milliseconds.
]]
---@type dirklib.cache
cache = {}

---Translate a key. Positional arguments substitute into %s, in order.
---@param key string
---@param ... any
---@return string
function locale(key, ...) end

