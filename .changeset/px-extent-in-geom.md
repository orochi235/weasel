---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

geom: the screen-pixel helpers live here now: `pxExtent`, `scaleDelta`, `screenAngleOf`, `standoff`, `withinPxBox`, `withinPxRadius`, and `meanScale`, with the `Scale2` type. They take a view's scale as two numbers and need nothing else from core. `@weasel-js/core` still exports every one of them.
