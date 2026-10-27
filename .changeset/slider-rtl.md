---
'@weasel-js/ui': patch
---

`Slider`, straight or along a curve, now follows its computed `direction`: under `rtl` its values run from the right
end, a press or a drag reads them that way, ArrowRight steps down and ArrowLeft up as a native range input's do, and
its readouts and stop labels sit under the mirrored thumbs. `paintGradientTrack` lays its ramp and hatching from the
right end there too. A slider in a left-to-right page is unchanged.

A straight slider's end stop labels now carry `data-edge="left"` / `"right"` (the side of the track they stand at) where they carried `"start"` / `"end"`.
