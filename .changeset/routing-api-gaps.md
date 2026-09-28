---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

The route-conflict check no longer reports two bindings whose actions' `eligible` rules can never hold together, so each mode's own Escape exit from `modeShortcuts` stops warning. The new `rulesExclusive(a, b)` is the test it uses: `true` only when no context passes both rules.

`createDepRegistry()` returns the stock dep registry `<DepRegistryProvider>` mounts, from routing's React-free entry and from core, for a dispatcher driven without a provider tree.

`DRAG_THRESHOLD_PX` and `pastDragThreshold(from, to)` expose the distance a press travels before `useGestureDispatcher` treats it as a drag, and the dispatcher reads that same definition.

There is one `defineTool` now. Routing's defaulted its overlay type to `unknown`, so its tools failed core's `tools` prop; routing now defaults it to `KernelOverlay`, which a kernel sets by merging into the new `OverlaySchema` interface, and core merges `RenderLayer` there and re-exports routing's `defineTool` and `defineViewportTool` instead of wrapping them.
