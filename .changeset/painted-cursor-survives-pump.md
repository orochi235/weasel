---
'@weasel-js/cursor': patch
'@weasel-js/routing': patch
---

A painted cursor survives the hover-cursor pump. An action whose `activeCursor` is a painted glyph keeps its cursor through the gesture, where it used to show none: `Dispatcher.inFlightCursor()` now returns the declared `CursorSpec` and no longer its CSS form. And a painted tool cursor stops drawing under a CSS cursor a handle shows: `PaintedCursorState.setOverride` takes `'none'` for that, which paints nothing until the override clears.
