---
"@weasel-js/svg": patch
---

SVG export now writes a marker's inset as `wzl:inset` on its `<marker>` def, and `parseSvg` reads it back, so a re-imported marker that is not registered in the importing session still stops the line short of a filled head instead of running it underneath.
