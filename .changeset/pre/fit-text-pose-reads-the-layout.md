---
'@weasel-js/core': patch
---

`fitTextPose` sizes a box the renderer will actually fill

It was the fourth site measuring text its own way: `ctx.measureText` per
character against system fonts, no kerning, `pose.text` only. Nothing masked
it the way the WebGL context masked the caret — a consumer calling it got a
box that disagreed with the paint, narrower by a kern on every pair and wrong
by the whole difference between the installed family and the registered face.
It goes through the shared layout now, so it sees kerning and per-run styling.

**Breaking:** `fitTextPose(ctx, pose, opts)` is now `fitTextPose(pose, opts)`.
