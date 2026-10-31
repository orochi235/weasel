---
'@weasel-js/renderer': patch
---

A convex clip of up to eight straight edges no longer breaks the batched run on a target where the batch shader cannot
clip it: a multisampled canvas (the browser default), a retained surface, or an effect's target. Staged geometry is cut
to the clip's half-planes on the CPU instead of the clip going on the stencil, and a turned item across a rect clip
there is cut too rather than sent to the stencil. A cut point on a slanted edge is not one the rasterizer can hold, so
a sample within its snapping distance of the clip's edge can land the other way from the stencil's.

An inner or outer stroke on a fill that is one convex ring, curved or straight, is cut to its side of the fill on the
CPU and joins the run, where it used to flush the run and draw itself through a stencil pass. A stroke with per-vertex
colors, or on a fill that is not convex, keeps the stencil.
