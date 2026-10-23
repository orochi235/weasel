---
"@weasel-js/core": patch
"@weasel-js/ui": patch
---

`core:flipX` and `core:flipY` are two trapezoids, short edges facing each other across the middle and long edges along the sides: one filled, its mirror outlined. Their straight edges sit on whole pixels at 16 px, so the glyphs no longer blur there. WeaselDraw's `symmetry` uses the same pair with both halves outlined, so the mode stops looking like the flip action.

The transport glyphs (`play`, `pause`, `stop`, `stepBack`, `stepForward`, `rewind`, `fastForward`, `live`) are drawn 1.3 times larger, as tall as `close` or `search`, and `Transport` draws them at 16 px rather than 14.
