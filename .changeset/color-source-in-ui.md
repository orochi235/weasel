---
'@weasel-js/paint': patch
---

Adds API: `cssColorLiteral(css)` in `@weasel-js/paint` reads any color string `parseColor` reads as an `srgb` `ColorLiteral`, and throws as it does on one it cannot. `colorLiteralToCss(literal)` writes a literal as a CSS color: hex where `colorLiteralToHex` has one, else `color(<space> …)`.
