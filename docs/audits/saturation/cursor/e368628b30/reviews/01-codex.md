# Review saturation for `cursor`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 12 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Painted state equality and observable cursor fields | 1 | 1 | 0 |
| 2 | Sink base and override ownership across target replacement | 0 | 1 | 1 |
| 3 | Brush sizing, zoom conversion, and bake cache keys | 0 | 1 | 2 |
| 4 | Glyph mark placement, path transforms, and rotation fit checks | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Painted cursor state retains the old fallback after an update

[paintedCursorState.ts](packages/cursor/src/paintedCursorState.ts#L63) · Pass 1 · Low · Source-traced

With a pointer present, set a painted base with fallback 'crosshair', then set the same glyph, angle, and size with fallback 'wait'. The equality check discards the second cursor, so current().cursor.fallback still reads 'crosshair' and subscribers hear nothing. The public frame returns the whole cursor, including the fallback.

Source and tests were left untouched.
