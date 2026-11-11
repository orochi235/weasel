---
"@weasel-js/core": patch
"@weasel-js/kernel3d": patch
"@weasel-js/guides": patch
---

A snap candidate can say whether it holds at the resolved move (`holds`), and the 2D and 3D sessions resolve again without a member that does not, through the new `resolveHolding`. `spacingSnapSource` uses it: an equal-spacing snap on one axis that another axis's snap carries the box away from no longer holds the box where its neighbors leave it no such gap, with no gap marked; snapping the box again from there moved it.
