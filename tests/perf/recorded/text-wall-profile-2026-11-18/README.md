# Where a frame of static text goes

This is a CPU profile of `text-wall.spec.ts`, `block` layout, run with `WEASEL_PERF_PROFILE=1`. It
ran on studio (Apple M1 Max, Chromium 158) on 2026-11-18, at `a1baa9fc1f`, one pass per cell. It
did not run on msb-uai, where the 2026-11-17 comparison ran, because that node was in its quiet
hours. So the milliseconds here run about 15% above that comparison's, while the shares carry over.

The profile covers the 90 measured frames and leaves the warmup out. Sampling is every 100 µs.
The figures are ms per frame inside `WeaselRenderer.render`. "Self" is time in a function's own
body; "total" also counts what it calls.

| Glyphs | render | `placeGlyph` total | `pushGlyph` self | buffer upload | `fitQuad` | `drawTextGroup` self | draws | bytes/frame |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
|   3,520 |  0.57 | 0.26 | 0.10 | –    | –    | 0.03 |  1 |  0.56 MB |
|  13,360 |  1.71 | 1.04 | 0.42 | –    | –    | 0.07 |  2 |  2.14 MB |
|  44,080 |  4.86 | 3.12 | 1.33 | 0.10 | 0.10 | 0.19 |  6 |  7.05 MB |
| 114,400 | 12.61 | 7.61 | 3.55 | 0.63 | 0.27 | 0.47 | 14 | 18.30 MB |

A dash is under the 0.05 ms the digest lists. At 114k with the camera still, the frame is
12.56 ms, split the same way. Layout lookups (`cachedPaintRuns`) and GC each come to under
0.05 ms a frame at every size.

"Bytes/frame" counts what the frame wrote through `bufferSubData` and `bufferData`, measured at
the context. It comes to 160 bytes a glyph: four 40-byte vertices. "Draws" is
`lastFrameStats().drawCalls`.

`node digest.mjs <file>.cpuprofile [frames]` prints the table for one profile.
