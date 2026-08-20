# Can a design editor be a tab inside the new settings menu?

**From:** the dirk_loading / dirk-ui-studio side
**For:** whoever is redesigning the scriptSettings system
**Status:** answering one question, not proposing a design

---

## The question

If a script ships a design editor (dirk_loading, dirk_multichar — more later), can that
editor appear as a tab inside the new central settings menu, so everything is in one panel?

## The short answer

**Not by rendering it there.** A central menu can *launch* it, or *embed* it, but it cannot
host it as a React tab. One fact decides this.

## The fact that decides it

**A studio manifest contains FUNCTIONS, so it cannot cross a NUI boundary.**

`dirk-ui-studio/src/core/types.ts`:

| field | type |
|---|---|
| `subscribe` | `(onChange) => () => void` — live data subscription |
| `snapshot` | `() => Record<string, unknown>` — reads live state |
| `resolveImage` | `(name) => string` — resource-relative asset paths |
| `locale` | `LocaleProvider` — `.get(key)` |
| `actions[].run` | the action bodies themselves |

dirk_loading's manifest closes over its **audio store** for now-playing, its **own asset
folder** for images, and its **own locale strings**. None of that is data. It is live code
running inside dirk_loading's NUI.

dirk_lib's config panel is a **different NUI page in a different resource** — a separate
browser context. You cannot render a React component from resource A inside resource B's
page, and you cannot serialise these manifests to send them over.

## The three shapes that actually work

### A. Deep-link — cheap, works today

Central menu lists a **Design** entry per script. Clicking it closes the settings panel and
fires the owning resource to open its own studio. That is exactly what `/dirk_loading` does
now, just discoverable from one place instead of a command per script.

- One place to find everything ✔
- Two visual panels, a blink between them ✘
- **Cost: near zero.** A registry of "resource → open event", and a list entry.

### B. Consumer-registered React tab — not possible

Would require passing a render function across the NUI boundary. There is no mechanism.
Listing it only so it stops coming up.

### C. Iframe the editor into the panel — possible, fiddly

`<iframe src="nui://dirk_loading/web/build/index.html?studio=1">` inside dirk_lib's panel.
CEF allows it and cross-resource `nui://` URLs are addressable, so each editor keeps running
its own code while looking like one app.

- Feels like a single panel ✔
- Focus, sizing and keyboard handling across the frame are real work; `postMessage` becomes
  the bridge for open/close/save ✘
- **Cost: medium.** Worth it only if "one panel" is a hard requirement.

### D. Move the Studio into dirk_lib — the "right" answer, expensive

dirk_lib hosts the Studio; consumers register manifests as **data** and every action becomes
a round-trip back to the owning resource.

- Genuinely one app ✔
- Requires manifests to stop containing functions. Live sources are the hard part: the
  now-playing panel subscribes to a store and re-renders ~4×/sec — as a cross-resource
  round-trip that is either laggy or a flood ✘
- **Cost: high**, and it breaks the current manifest contract for both existing studios.

## What I would do

**A now, C if one-panel turns out to matter.** D only if the studio becomes central to the
product rather than a per-script feature.

## What I need to know from your side

1. Is "one visual panel" a hard requirement, or is "one place to find everything" enough?
   That is the whole A-vs-C decision.
2. Does the new settings menu have a concept of **a resource contributing an entry** —
   even just a label + an event to fire? A is trivial if so.
3. Are you planning for settings to live in dirk_lib's NUI, or somewhere else? If the panel
   itself moves, C changes shape.

## Where this currently stands on my side

dirk_loading mounts `<Studio>` and passes its settings form in via `settingsSlot` — so today
the relationship is inverted from what you are proposing: **the Studio owns the shell and
settings is a tab inside it.** dirk_multichar does the same. Both use a shared `SettingsShell`
from the package, so the chrome is already common.

I am treating that as provisional and not building anything else that assumes it.
