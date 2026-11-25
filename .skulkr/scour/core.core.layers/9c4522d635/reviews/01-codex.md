# Review saturation for `core.core.layers`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 13 files listed for this area in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Layer visibility wrappers and tile caching | 1 | 1 | 0 |
| 2 | Retiling and runtime option changes | 1 | 2 | 0 |
| 3 | Redraw source attachment and cleanup failures | 1 | 3 | 0 |
| 4 | Ordering, group ownership and compositing | 0 | 3 | 1 |
| 5 | Retained command qualification and draw-path error handling | 0 | 3 | 2 |
| 6 | Tile split bounds, budgets, dimensions and basic layers | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| L1 | Hiding a gated tiled layer can leave cached tiles visible and hit testing disabled | [gateLayer.ts](packages/core/src/core/layers/gateLayer.ts#L20) | 1 | Medium | Source-traced |
| L2 | Tile pyramids keep stale structural options after a layer update | [tileHost.ts](packages/core/src/core/layers/tileHost.ts#L88) | 2 | Medium | Source-traced |
| L3 | A failed redraw subscription can leave earlier listeners attached | [redrawSource.ts](packages/core/src/core/layers/redrawSource.ts#L14) | 3 | Low | Source-traced |

- **L1.** Wrap a visible tiled layer without its own `deps`. Draw it, change the predicate to false, and repaint. The wrapper suppresses live drawing and hit testing, but keeps the tile definition and adds a visibility dependency only if the original layer supplied one. The tiled path can return already baked pixels without calling the gated draw function. [Tiled draw branch](packages/core/src/core/layers/render.ts#L239)
- **L2.** Update a layer's `maxLevel`, `fadeMs`, or its `bounds` callback while preserving the layer ID and tile pixel size. The host continues to use its original pyramid, constructed with the old options and a floor callback closing over them. The next frame reads new damage input but uses stale geometry and cache policy.
- **L3.** Compose two redraw sources, with the second throwing as it subscribes. The first source already holds the listener, but the combination never returns an unsubscribe. Likewise, when an early unsubscribe throws, later ones in the returned disposer are skipped. This can retain a repaint callback after a failed setup or teardown.

Source and tests were left untouched.
