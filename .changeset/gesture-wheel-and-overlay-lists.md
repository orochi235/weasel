---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/kernel3d': patch
---

An ongoing gesture can take the wheel while it is in flight. `OngoingHandle.onWheel(ctx)` is called with each wheel event before any wheel binding sees it, newest gesture first; returning `true` claims the event, so the viewport neither zooms nor pans, and anything else lets it through to the bindings as before.

`OngoingHandle.overlay()` may now answer a list of overlays as well as one, for a gesture showing several runs at once. This is breaking for code that reads `overlay()` directly and expects a single overlay: read it through the new `overlaysOf(handle)`, exported from routing and core, which always answers a list. Core's overlay painter, gesture bounds and parallax-plane mapping, and kernel3d's `collectOverlayBoxes`, all read it that way.

`OverlayRole` names three more kit roles, each with a stroke in core's overlay painter: `falloff` (the reach of a soft-selection drag), `snap` (a line a dragged point snapped to) and `lock` (what a held constraint keeps it on).
