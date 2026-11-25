# Review saturation for `core.canvas.nodeShapes`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 12 files listed for this area in the working-tree [Skulkr partition](docs/audits/partition.json). The passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Shape dispatch, stored generator fields and rendering | 1 | 1 | 0 |
| 2 | Animated paint and consistency with drawn bounds | 1 | 2 | 0 |
| 3 | Trim span, stroke reach and outline picking | 0 | 2 | 1 |
| 4 | Image fallback, pixel sizing, node types and group boxes | 0 | 2 | 2 |
| 5 | Derived part styling, cache invalidation and inherited paint | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| N1 | A legacy stored polygon or star count can stall painting | [shapePainter.ts](packages/core/src/canvas/nodeShapes/shapePainter.ts#L99) | 1 | Medium | Source-traced |
| N2 | Animated trim can create square-cap overhang omitted from a smooth shape's drawn bounds | [shapePainter.ts](packages/core/src/canvas/nodeShapes/shapePainter.ts#L73) | 2 | Medium | Source-traced |

- **N1.** A rect-posed node with `data.shape = 'polygon'` and a non-finite `data.sides` enters the legacy built-in shape painter. With positive infinity the count is passed unchanged to the polygon builder, whose vertex loop lacks a finite endpoint. The same path exists for `points` on a star. This is the drawing caller for the constructor issue reported in `geom.paths.part1`; the node's stored legacy count bypasses generator validation. [Polygon constructor](packages/geom/src/paths/builder.ts#L254)
- **N2.** Paint a circle with a square-capped stroke and no static dash or trim. Animate its trim so an endpoint lies near a cardinal extremum. The paint command gains the trim via `withAnimatedTrim` and the open ribbon can push a cap corner beyond the even outset. The bounds path checks the declared trim only, so it still takes the smooth-outline shortcut and can report a box smaller than the painted cap.

Source and tests were left untouched.
