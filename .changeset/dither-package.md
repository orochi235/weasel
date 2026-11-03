---
'@weasel-js/dither': patch
'@weasel-js/renderer': patch
'@weasel-js/core': patch
'@weasel-js/geom': patch
---

New package `@weasel-js/dither`: `ditherPixels` quantizes exported pixels to 1-bit ink by threshold, Bayer, Floyd–Steinberg or Atkinson, keeping protected regions at plain threshold, and `dither` is the same threshold and Bayer as a live renderer effect, on the screen grid or an output target's dot grid (`gridOnScreen`). The renderer gives every effect pass `u_windowOrigin`, where its buffer sits in the drawing buffer; a layer group's effect thunk now receives `LayerDims`, with `dpr`; geom exports `OutputGrid`.
