---
"@weasel-js/ui": patch
---

`Slider` thumbs no longer hang half off the ends of the track. A new `thumbFit` prop, `'inside'` by default, runs the value range half a thumb short of each end, so a thumb at `min` or `max` sits flush with the track's edge the way a native range input's does; `thumbFit: 'overhang'` restores the old edge-to-edge layout. The track's outer size is unchanged. Dragging, track presses, stop marks, stop labels and below-thumb readouts all follow the inset range, and `renderTrack` receives a new `TrackCtx.fractionToPosition(f)` giving the CSS position of a point in that range. `paintGradientTrack` lays its ramp over the same range and fills the padded ends with the end colors, so in `GradientEditor` a stop at offset 0.3 sits over the ramp's 30% point. A custom `renderTrack` that placed paint by percentage of the track should switch to `fractionToPosition` to stay lined up with the thumbs.
