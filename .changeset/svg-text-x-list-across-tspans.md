---
'@weasel-js/svg': patch
---

SVG import reads a `<text>`'s `x` list past its first value when the `<text>` holds `<tspan>` children, where it used to warn and drop it. Each position becomes the letter spacing that puts the glyph there, measured across runs of different styles, as it already was for a list on a `<tspan>` or on a `<text>` holding only text. It is read only where a loaded face measures the glyphs it reaches and no `<tspan>` among them has its own `x` or `dx`; otherwise the warning now says which.
