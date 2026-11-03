---
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

Add `ENGINE_STANDARD_ACTIONS`, the kit-standard actions a host of any dimension registers with `useActionSet`:
undo and redo, area and lasso select, select all and clear, move, clone, transform again, insert and its
companions, nudge, duplicate, delete, group and ungroup, escape and cancel. It is in `@weasel-js/core/engine`
with `WeaselProvider`, `IconRegistryProvider`, `CANVAS_CONTEXT_ATTRIBUTES` and `watchDevicePixelRatio`.

`deleteAction` no longer loads `@weasel-js/text`: `hiddenSourcesTakenWith` and `sourcesHiddenBy` moved to a module
of their own, still exported from the main entry as before.

labkit's 3D lab now builds on `@weasel-js/core/engine`, and its tiled surface and config read nothing from core's
main entry.
