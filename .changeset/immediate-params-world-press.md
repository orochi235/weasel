---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/diagram': patch
'@weasel-js/guides': patch
'@weasel-js/hud': patch
'@weasel-js/labkit': patch
'@weasel-js/minimap': patch
'@weasel-js/path-tools': patch
'@weasel-js/rig': patch
---

Breaking: an immediate action's params carry the event's point as `world`, a `WorldPoint`, in place of `worldX`/`worldY`, and a click's press point as `press` in place of `pressX`/`pressY`. Read `params.world.x` where you read `params.worldX`, and pass `{ world: { x, y } }` where you passed `{ worldX: x, worldY: y }`: to `trigger`, as a menu's params, and to an invoker called directly. The new exported `ImmediateParams` type names every field the dispatcher puts in the bag; cast `params` to it to read them. `trigger` asks `enabled` at `params.world`. A parallax plane now carries `press` into the plane as it already did the release point. The align and flip actions' `'pointer'` reference reads `world` too. The input events themselves are unchanged: a `ClickEvent` still has `x`/`y` and `pressX`/`pressY`, and `useClipboardOps`' `paste(at)` keeps its `{ worldX, worldY }` shape.
