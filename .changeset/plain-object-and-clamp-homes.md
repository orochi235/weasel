---
'@weasel-js/registry': patch
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/theme': patch
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/hud': patch
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

`isPlainObject` lives in `@weasel-js/registry` (core still exports it), and `@weasel-js/geom` exports a scalar `clamp(v, lo, hi)`. theme, prefs, labkit, and forge read plain objects through the one realm-safe test, so a `Date` or a `Map` no longer passes where they accept a record; ui's Slider and ResizeHandle, hud's loupe, and labkit's ZoomControl use geom's clamp. When its bounds cross, ResizeHandle now holds to `min` where it held to `max`. theme and prefs gain a dependency on registry, and ui's on geom moves from dev to runtime.
