---
'@weasel-js/core': patch
---

The solid batch stops re-sending index data a ring slot already holds, and
`u_color` / `u_alpha` join the per-frame uniform cache.

A run of rects has indices that are a pure function of the rect count, so a
slot coming round to the same count already holds the right bytes. A mesh's
indices are rebased onto the staged vertices and a respecified buffer keeps
nothing, so both mark the slot as holding no pattern and the next flush writes.

`u_color` and `u_alpha` were excluded from `UploadedUniforms` because several
places wrote them directly. All of those now go through `setColorUniform` /
`setAlphaUniform`, which makes the cache correct per program rather than
dependent on knowing which caller uses which — the batch holds `u_color` at
white forever and was re-sending it once per flush.

Measured together on an M2 Max via ANGLE (`tests/perf/clip-cost.spec.ts`): a
flush 5.39 -> 3.22 us, entering a clip 12.47 -> 9.53. Read the difference, not
the absolutes — the same spec measured a 4.35 us flush earlier on a cooler
machine, and only the two halves of one A/B are comparable.
