---
'@weasel-js/ui': patch
---

`useRovingTabIndex` mirrors Left and Right under right-to-left, in its linear and grid modes alike: Left steps forward and Right back, while Up, Down, Home and End are unchanged. It reads the container's computed `direction` at each keypress, so a `dir` attribute anywhere above it counts; the new `dir` option overrides that. `rovingTarget` and `rovingGridTarget` take the direction as a trailing argument, defaulting to `'ltr'`, and `RovingDirection` is exported.
