# Review saturation for `guides.grid`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 12 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Nested grid clipping and overlapping regions | 1 | 1 | 0 |
| 2 | Floating-point limits for cell lookup and snapping | 1 | 2 | 0 |
| 3 | Grid unit conversion, flipped axes, and local frames | 0 | 2 | 1 |
| 4 | Grid hover and highlight invalidation | 0 | 2 | 2 |
| 5 | Grid presets, fit checks, and rendering density | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Overlapping grid regions can reveal the root lattice through both cutouts

[layer.ts](packages/guides/src/grid/layer.ts#L140) · Pass 1 · Medium · Source-traced

The layer builds one even-odd clip from the parent outline and every child outline. Where two child regions overlap inside the parent, both contours toggle parity and make the parent visible again. The root grid can bleed through between two overlapping no-grid regions, even though regionAt resolves the overlap to a child that has no grid.

### 2. An unrepresentable periodic cell can still be returned as a zero-width cell

[axes.ts](packages/guides/src/grid/axes.ts#L148) · Pass 2 · Low · Source-traced

cellOf does not check whether the computed index is a safe integer or whether the two computed edges differ. With pitch 1, offset 0, and a coordinate of 2^53, both k and k+1 round to the same value. The lookup reports a numbered cell even though its edges coincide and linesIn refuses to enumerate lines at that precision.

Source and tests were left untouched.
