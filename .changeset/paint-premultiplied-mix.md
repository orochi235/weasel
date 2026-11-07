---
'@weasel-js/paint': patch
'@weasel-js/theme': patch
'@weasel-js/prefs': patch
---

`blendTheme` and the prefs color blend mix alpha premultiplied, as CSS `color-mix()` does, so a blend toward `transparent` keeps the other color's hue rather than drifting toward black. Both now go through paint's new `mixRgba` (two colors, in any `ColorInterpolationSpace`) and `mixRgbaWeighted` (any number, by weight). `mixOklab` is `mixRgba` in OKLab and now computes in float precision rather than through 8-bit channels.
