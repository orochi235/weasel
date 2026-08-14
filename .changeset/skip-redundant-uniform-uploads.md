---
'@weasel-js/core': patch
---

Stop re-sending unchanged uniforms on every draw command.

`u_proj` is constant for a whole frame and `u_colorMatrix` is the identity in
every scene that does not use a color matrix, yet both were uploaded for every
command — along with a fresh `Float32Array(16)` and a transpose per draw to
build the color matrix, and a fresh `screenToClip` matrix per draw to build the
projection. GL holds uniform state per program object, so all of that was
buying nothing.

`draw.ts` now remembers what it last sent each program and skips the upload
when the value has not changed. On a frame of 1,000 solid rects that takes
`uniformMatrix4fv` from 1,000 calls to 1 and `uniformMatrix3fv` from 2,000 to
2, and removes two per-draw allocations.

The cache hangs off the `DrawContext`, which is rebuilt per frame, so it cannot
outlive a frame or go stale against GL state changed between frames. It covers
only the four uniforms this module is the sole writer of — `u_color` and
`u_alpha` have several writers and are still sent every draw.

This does not measurably change frame time on an M2 Max: the draw loop is bound
by per-draw-call cost (~68 us per command), not by uniform uploads. It removes
the calls and the allocations; `docs/TODO.md` tracks what the remaining cost
actually is.
