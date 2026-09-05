---
'@weasel-js/core': patch
---

Coalesce consecutive image draws into one batch, and add `kind: 'sprites'` for a run handed over packed.

`drawImage` was one `drawElements` per command, so an atlas-backed wall of thumbnails paid a draw call per thumbnail: 20,000 of them cost 51ms a frame on an M2 Max, three frames' budget for one frame's work. Consecutive image quads now stage into an `ImageBatch` and flush as a single draw — 10.6ms for that frame, and 0.094ms where it was 3.05 at 512 quads.

Nothing changes for a consumer emitting `kind: 'image'`. A run merges across a group transform, a group alpha and a per-command opacity, because all three ride the vertices — opacity through a new `a_opacity` attribute, which is exact rather than conditional since `u_opacity` multiplies the alpha after the color matrix. A run breaks on a different bitmap, a different `sampling`, a clip boundary, or a color matrix.

`SpritesDrawCommand` is for the case where even a command object per quad is too much. It carries one bitmap and a `Float32Array` of `SPRITE_STRIDE` floats a sprite — `dx, dy, dw, dh, sx, sy, sw, sh, opacity`, source in bitmap pixels, a negative `sw`/`sh` mirroring that axis — and stages through the same run, so a packed run and the image commands around it merge into one draw. It takes 20,000 sprites to 0.79ms. Below a few thousand a plain run of image commands merges into the same draw and reads better.

Ring slots come in tiers sized to the flush. The driver's write hazard is per buffer object, so a one-quad flush into a slot sized for 256 waits on the whole thing — a frame of 20,000 quads that nothing merges cost 92ms against one slot size and 53ms against tiered ones, matching the unbatched path it replaces.
