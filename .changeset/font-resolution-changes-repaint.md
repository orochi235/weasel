---
'@weasel-js/font': patch
---

Changing what a family resolves to now repaints the text drawn in it. `setFontFallbackPolicy`, `setDefaultFontFamily`, `registerCanvasFont` and `unregisterCanvasFont` each advance `glyphGeneration()` and notify `subscribeGlyphReady` when they change something. Before, text already on a canvas kept its cached layout from before the change: switching to `'none'` left a substituted line visible, and enrolling a family at runtime did not redraw it. A call that changes nothing still notifies nobody.
