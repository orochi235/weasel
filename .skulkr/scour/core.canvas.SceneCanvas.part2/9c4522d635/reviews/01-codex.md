# Review saturation for `core.canvas.SceneCanvas.part2`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 45 files listed for the area in the working-tree [Skulkr partition](docs/audits/partition.json). The passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Controlled camera writes and animation ownership | 1 | 1 | 0 |
| 2 | Edge panning, pointer coordinates and drag limits | 1 | 2 | 0 |
| 3 | Picker bounds, camera planes and finite geometry | 1 | 3 | 0 |
| 4 | Worker and page layer handoff, paint sources and redraw subscriptions | 0 | 3 | 1 |
| 5 | Tool registries, action tuning and shortcut routing | 0 | 3 | 2 |
| 6 | Selection chrome, viewport actions and nested view inputs | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| S1 | A dropped animation proposal can cause the next outside camera update to be treated as an animation write | [useCanvasCamera.ts](packages/core/src/canvas/SceneCanvas/useCanvasCamera.ts#L64) | 1 | Medium | Source-traced |
| S2 | Edge-pan limits use ancestor-scaled dimensions as camera layout dimensions | [useEdgePan.ts](packages/core/src/canvas/SceneCanvas/useEdgePan.ts#L99) | 2 | Medium | Source-traced |
| S3 | A finite pick box can be rejected when its fields sum to infinity | [useScenePickers.ts](packages/core/src/canvas/SceneCanvas/useScenePickers.ts#L214) | 3 | Low | Source-traced |

- **S1.** Use a controlled camera and let its consumer decline or round away a proposed animation frame without updating the prop. The runner sets its write flag, and the unchanged prop leaves that flag set. When the consumer later sets an unrelated view, the stale flag suppresses interruption. The next animation frame can still move toward the old destination. This can occur across separate renders.
- **S2.** Scale a 100 CSS px canvas to twice its layout size through an ancestor, enable edge-pan bounds, and drive a drag at its edge. The controller measures a 200 client-pixel width and feeds that value into `viewportWorldRect` and `clampView` as though it were the layout width. At zoom 1 it clamps against a 200-unit world span even though the camera shows 100 units. Client coordinates are appropriate for deciding proximity to the visual edge, but the camera clamp uses layout pixels.
- **S3.** A custom descriptor can return a finite box at approximately `(1e308,1e308)` with a representable positive extent and finite far edges. The summed finiteness guard rejects it because adding the two coordinates overflows. A camera positioned nearby can still project the box, since projection subtracts one axis's camera coordinate at a time. The picker bounds API returns null instead.

Source and tests were left untouched.
