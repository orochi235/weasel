---
"@weasel-js/ui": patch
---

`paintGradientTrack` paints a curved slider track. On a `Slider` given a `shape` or placed in an `Along`, it strokes the band along the curve with the same sampled ramp, carries the end colors over the band past the value span, and dims and hatches the band outside `activeRange`, where it used to draw nothing.

`TrackCtx.shape` is typed as the `TrackRun` it always was, so a painter can reach the run's whole `shape` and where the value span sits on it (`from`, `to`, `reversed`).
