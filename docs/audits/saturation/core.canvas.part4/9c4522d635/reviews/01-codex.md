# Review saturation for `core.canvas.part4`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 37 files listed for this area in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | View nesting, follow relationships and recursive reads | 1 | 1 | 0 |
| 2 | Measured and explicit size changes, resize notifications | 1 | 2 | 0 |
| 3 | Canvas view ownership, clamp and client mappings | 0 | 2 | 1 |
| 4 | Frame lifecycle, renderer redraw sources and shader updates | 0 | 2 | 2 |
| 5 | View registry, picking, overlays and handle wiring | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| V1 | Cyclic view nesting can overflow a layer query despite guarded frame measurement | [useViewNesting.ts](packages/core/src/canvas/useViewNesting.ts#L85) | 1 | Medium | Source-traced |
| V2 | A canvas with explicit dimensions can collapse and restore without an onResize callback | [useSurfaceSize.ts](packages/core/src/canvas/useSurfaceSize.ts#L37) | 2 | Low | Source-traced |

- **V1.** Register views A and B with each naming the other as parent. Frame measurement stops recursive reentry, and the registry orders a cyclic set without rejecting it. Calling either registration's `drawnLayers()` then follows parents recursively without that guard. `layerIsPainted` can do the same once the local gate admits the layer. A bad parent graph should give an empty answer or a clear configuration error.
- **V2.** Mount a surface with explicit width and height 100, then render explicit width 0 and later restore width 100. The zero is treated as an unresolved measurement even though the caller supplied it. The last reported width stays 100, so the restoration is suppressed too. The callback's contract describes each size change, and these are two effective size changes.

Source and tests were left untouched.
