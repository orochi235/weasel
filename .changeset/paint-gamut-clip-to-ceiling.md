---
'@weasel-js/paint': patch
---

An out-of-gamut OKLab or OKLCh color is clipped to within 1e-6 chroma of the sRGB boundary, so asking `oklchDegToHex` for far more chroma than a hue has returns that hue's full ceiling instead of as little as half of it.

<!-- entry: fix visual -->
