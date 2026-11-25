# Review saturation for `editing.chrome`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 10 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Selection outline cache after a cap-only change | 1 | 1 | 0 |
| 2 | Selection pose resolution during move and resize overlays | 0 | 1 | 1 |
| 3 | Rotation badge placement and nonuniform view scales | 0 | 1 | 2 |
| 4 | Resize handles, shape outlines, and chrome overlay ordering | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An open path's own cap change can reuse its old selection outline

[shapeOutline.ts](packages/editing/src/chrome/shapeOutline.ts#L95) · Pass 1 · Low · Source-traced

Select an open path with a stable derived path and an explicit butt-capped stroke, then change the stroke to a square cap without changing its width. The band depends on cap geometry, but the cache key still sees the same path, inherited paint, and outset. The selected outline can retain the butt cap while the path draws a square cap.

Source and tests were left untouched.
