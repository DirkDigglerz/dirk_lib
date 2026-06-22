Confirmed: `deepClone` (shared.lua:59-69) has no visited-set/cycle guard — a self-referential table would infinite-recurse with no yield. And `dispatchScriptConfigWatchers` (server.lua:530-549) is a synchronous inline loop with no yield between watchers. Both findings are accurate. I have enough to write the brief.

# dirk_lib hang/load brief — fishing-reachable paths

## 1. Ranked: lib functions fishing can trigger that hang or get heavy

| # | Function | Risk | Confidence | 1.2.54 mitigates? |
|---|----------|------|-----------|-------------------|
| 1 | `getGroupsBundle`→`getJobs`+`getGangs` (the `getFrameworkGroups` callback) — `modules/framework/server.lua:57-65`, bridge `bridge/framework/qb-core/server.lua:259-314` | **Heavy hitch (5.7s measured), NOT a hard hang** | High | **Yes** — 15s TTL memo at `server.lua:15-65` collapses the per-player restart burst to one build |
| 2 | `scriptConfig.set`/`setScriptConfig` — `modules/scriptConfig/server.lua:800-881` | Multi-second hitch on save; **theoretical hard hang only via an unguarded table cycle** (deepClone has no cycle guard, `modules/table/shared.lua:59-69`) | Medium | No |
| 3 | `dispatchScriptConfigWatchers` — `modules/scriptConfig/server.lua:530-549` | Un-yielded inline watcher fan-out; player-scaling work lands in fishing's callbacks (e.g. dailyChallenges loops GetPlayers) | Medium | No |
| 4 | `lib.player.checkOnline` (string/citizenId form) — `modules/player/server.lua:197-212` | O(players) per call, 2× GetPlayer per player; amplified to O(traps×players) un-yielded in `crabPots.lua:1043` fill tick | Low | No |
| 5 | `scriptConfig.get`→`cloneValue`→`deepClone` — `server.lua:1112-1118`, `:470` | Full-subtree deep clone every call; CPU-only unless called in a per-tick/per-player loop | Low | No |
| 6 | `registerScriptConfig` (boot) — `server.lua:586-794` | Boot-only; heavy passes interleaved with yielding MySQL awaits | Low | No |
| 7 | `getGroups`/`getGroup` (raw, **un-memoised**) — `modules/framework/server.lua:33-46` | Each call = two fresh full Shared.Jobs/Gangs walks; **not covered by the memo** | Low (no hot fishing caller) | **No** |
| 8 | `installItems.regenerate` (+3× synchronous `SaveResourceFile`) — `installItems.lua:277-288` | Edit-time disk hitch, fingerprint-gated | Low | No |
| — | `lib.callback.await`, `hasGroup`, all `lib.player.*` per-src getters, `lib.inventory.*` | None | — | — |

## 2. The groups/framework path — "his server not yours"

**Can it 45s-hang? No. It can only hitch.** Every entry into this path is via `lib.callback.await('dirk_lib:getFrameworkGroups')`, which `Citizen.Await`s on the **client** side (`modules/callback/server.lua` / `init.lua:194`) and **yields**. The server handler runs `getGroupsBundle` in one synchronous slice but it is a tight in-memory Lua-table walk — no loop, no DB, no blocking primitive — so it terminates. No 45s infinite-hang vector exists here.

**How it scales (the exact mechanism):** `getJobs` (`qb-core/server.lua:259-287`) does `pairs()` over **all** of `QBCore.Shared.Jobs`, an inner `pairs()` over each job's grades, a `table.sort(grades)` **per job**, then a final case-insensitive `table.sort` over the whole job list (`:285`). `getGangs` (`:289-314`) is identical over `Shared.Gangs`. Cost ≈ **O(jobs×grades + jobs·log jobs)**, superlinear via the sorts. It reads the in-memory table only — no DB round-trip — so the entire cost is the size of `Shared.Jobs`/`Shared.Gangs`.

**Why richopov and not the author's servers:** richopov's large RP framework means a big `Shared.Jobs` → one cold build is ~1-2s+ (his 5.7s is the *aggregate*). Pre-1.2.54 there was **no memo**, so on a resource restart / mass NUI mount, the auto-fetcher fired this **once per player** (dirk-cfx-react `registerInitialFetch("GET_FRAMEWORK_GROUPS")` + `useAutoFetcher`, fishing `App.tsx:30/46`) → ~26 identical full rebuilds stacked in a burst = the 5.7s. The author's light servers have a tiny jobs table and few players, so the same code is sub-100ms. **1.2.54's 15s TTL memo collapses the burst to a single shared build.** Note: `getGroups`/`getGroup` (`server.lua:33-46`) are **not** memoised, but they have no hot fishing caller (fishing's NUI path uses `getGroupsBundle`; `lib.getGroup` is rebound to the cheap O(1) dirk_groups runtime store at `src/groups/server/class.lua:108`).

## 3. Honest verdict on a credible 45s HARD hang

**No — there is no credible single-call 45s hard-hang source in dirk_lib reachable from fishing.** Like fishing's own code, lib is essentially yield-safe / config-bounded:

- The heaviest measured path (framework/groups) is bounded CPU reached only through a **yielding** client `callback.await`, and a single build of even a huge `Shared.Jobs` is low-second, not 45s.
- Every loop that waits yields: `while not MySQL do Wait(100)`, all `MySQL.*.await`, `Citizen.Await` (5-min callback timeout, but yielding).
- All the un-yielded synchronous work (bundle builds, `smartMerge`, `canonicalJson`, `hashSettings`, `collectChangedLeaves`, watcher dispatch, `checkOnline`) is **bounded by config size or player count** — it burns CPU / hitches, it does not loop forever.

**The one theoretical hard-hang vector:** `lib.table.deepClone` (`modules/table/shared.lua:59-69`), and the `merge`/`compare`/`canonicalJson` siblings, have **no visited-set or depth guard**. A self-referential/cyclic table reaching `setScriptConfig`'s deepClone chain (`server.lua:800-881`) would infinite-recurse with zero yields → permanent svMain hang. This is the only "could-be-45s" shape, but it requires a malformed cyclic config and only fires on an admin **save**, not steady-state gameplay — so it does not match a *spontaneous* 45s hang. **Conclusion: the 45s hard hang almost certainly originates outside the fishing-reachable dirk_lib surface** (a genuinely un-yielded loop or blocking sync primitive elsewhere). dirk_lib explains the 5.7s + multi-second hitches, not the 45s.

## 4. Safe scale-proofing fixes worth making in lib

1. **Cache/freeze the framework build, not just `getGroupsBundle`.** Promote the 15s memo (`framework/server.lua:57-65`) to wrap `getJobs`/`getGangs` themselves, so raw `getGroups`/`getGroup` (`:33-46`) and any future consumer also benefit, instead of re-walking `Shared.Jobs` twice per call. Optionally invalidate on a jobs-changed event rather than TTL.
2. **Add a cycle guard to `deepClone`/`merge`/`compare`/`canonicalJson`** (`modules/table/shared.lua:59,154,227`; `scriptConfig/server.lua:380`) — a `visited` weak-keyed set or a recursion-depth cap. This closes the only theoretical hard-hang in the lib surface at near-zero cost.
3. **Tighten `checkOnline` string path** (`player/server.lua:197-212`): it calls `lib.player.get(ply)` then `lib.player.identifier(ply)` which calls `get` again — 2× GetPlayer per player. Drop to one `get()` per player, or maintain a `citizenid → src` index, to kill the O(rows×players) / O(traps×players) amplification in `crabPots.lua:1043` and `levels.lua:172`.
4. **(Optional) Yield-chunk the big synchronous passes** in `setScriptConfig`/`canonicalJson`/`hashSettings` for very large configs (e.g. `Citizen.Wait(0)` every N leaves) to convert a multi-second save hitch into a spread-out cost. Lower priority since it's admin-save-only.

Key cited files: `C:\Users\Administrator\Desktop\[dirk]\dirk_lib\modules\framework\server.lua:15-65`, `bridge\framework\qb-core\server.lua:259-314`, `modules\scriptConfig\server.lua:498-549, 800-881, 1112-1118`, `modules\table\shared.lua:59-69`, `modules\player\server.lua:197-212`.