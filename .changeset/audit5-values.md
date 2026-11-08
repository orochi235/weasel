---
'@weasel-js/quantity': patch
'@weasel-js/paint': patch
'@weasel-js/p-touch': patch
---

Fix edge cases in quantity formatting, color parsing and paint keys, and in `.lbx` output.

- A `compact` value that shows as `1.00K` (999.6, say) is now spoken `1 thousand`, not `1.00K`.
- `nearestFraction` reads a denominator cap under 1 as 1 instead of returning a fraction over 0.
- `parseColor` throws on an empty or non-decimal channel: `rgb(255, 0, 0,)` used to parse as transparent red, `rgb(1 2 3 / foo)` as opaque, and `rgb(0x10, 0, 0)` as hex.
- `paintKey` gives two solids one key when their colors are the same color spelled differently (`#fff`, `#FFFFFF`, `white`).
- `sampleGradientStops` reads a NaN position as the first stop instead of writing `#NaNNaNNaNNaN`, and answers an empty stop list in hex (`#00000000`) like every other answer.
- `hexToColorLiteral` leaves `alpha` off a fully opaque `#rrggbbaa`, as `cssColorLiteral` does.
- `writeLbx` frames a rect drawn with a negative width or height where it lies, and writes a cut position given twice only once.
