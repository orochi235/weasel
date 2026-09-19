---
'@weasel-js/theme': patch
---

A token's alpha extension (`com.weasel.alpha`) now works whatever color the
token it references holds. Resolving a theme used to throw unless that color
was a hex literal. Now hex (including 4- and 8-digit forms) and `rgb()`/`rgba()`
become an `rgba()` literal, and any alpha the color already carried is
multiplied in, matching what the CSS output's `color-mix()` does. A color that
cannot be read without a browser — a named color, `hsl()`, `oklch()` — resolves
to that same `color-mix()`. No existing output changes.
