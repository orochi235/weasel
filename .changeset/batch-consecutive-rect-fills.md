---
'@weasel-js/core': patch
---

Merge consecutive solid-fill rects into one draw call.

The draw loop cost a flat ~66 us per draw call at every scene size, so a frame
of 3,200 rects took 212 ms. Solid-fill rects now append into a growable vertex
buffer and go out as a single `drawElements` at flush. Fill color rides the
vertices — the batch draws through the existing `pathFillVColor` program with
`u_color` held at white, which is bit-identical to the flat program's math.

Frame cost on an M2 Max via ANGLE at 800x600 (`npm run test:perf`):

| rects | before | after |
|---|---|---|
| 400 | 25.62 ms | 0.03 ms |
| 1,600 | 105.63 ms | 0.11 ms |
| 3,200 | 211.78 ms | 0.15 ms |

Painter's order is unchanged. A run absorbs only consecutive commands and
flushes before anything it cannot express: another fill kind, a stroke, a clip
push or pop, or a group changing the transform, alpha, or color matrix. Nothing
else in the loop got faster — a frame alternating solid and gradient rects still
costs ~34 us per command, now almost entirely the gradient half.
