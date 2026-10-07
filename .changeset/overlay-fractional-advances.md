---
'@weasel-js/core': patch
---

The text edit overlay sets `text-rendering: geometricPrecision` for faces the kit lays out itself, so it keeps the canvas's fractional glyph advances on Linux Chromium. Before, Chromium there rounded every advance to a whole pixel and the overlay ran ahead of the canvas glyphs as a line got longer: 3px over "Small Caps" at 24px. A family served by the canvas-font tier keeps the browser's default rendering, which is what the canvas measures it with.
