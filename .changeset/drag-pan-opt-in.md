---
"@weasel-js/core": patch
"@weasel-js/labkit": patch
---

`viewport.dragPan` no longer declares a default binding, so a plain drag that no tool claims no longer pans the view. The hand tool still pans (H, or hold space), and a canvas that should pan on any unclaimed drag — a viewer, a map — adds the new `dragPanContribution()` to its `ambient` list; it takes the same `axis` and `inertia` params the hand tool passes. labkit's trial cameras keep panning on a plain drag.

This is a behavior change for any canvas with the `view` preset that relied on a plain drag panning under a tool that binds none.
