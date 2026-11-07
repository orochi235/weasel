---
'@weasel-js/dither': patch
---

`ditherPixels`, `maskToRgba`, `protectMask` and `protectTexture` throw a `RangeError` naming the size for a width or height that is negative, fractional or not finite. `ditherPixels` used to quantize a -1×-1 image as one pixel, and the others failed inside a typed-array constructor or returned a mask of the wrong size.
