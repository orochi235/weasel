# Review saturation for `guides.layout`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 13 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Snap target metadata and fallback behavior | 1 | 1 | 0 |
| 2 | Quadtree capacity and size-based admission | 1 | 2 | 0 |
| 3 | Sequence ordering, reflow, and commits | 0 | 2 | 1 |
| 4 | Tile grid occupancy and overflow | 0 | 2 | 2 |
| 5 | Strategy dispatch, fixed targets, and slot geometry | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Null cell metadata aborts nearest-target fallback

[snaps.ts](packages/guides/src/layout/snaps.ts#L78) · Pass 1 · Low · Source-traced

The legacy metadata guard accepts null cellRect because typeof null is object. A custom layout target carrying that metadata reaches rectContainsPointHalfOpen and throws instead of falling back to its origin.

### 2. Quadtree offers the root as a fit for an oversized child

[quadtree.ts](packages/guides/src/layout/strategies/quadtree.ts#L158) · Pass 2 · Medium · Source-traced

depthOf always returns at least zero, even when sizeOf exceeds the root cell. The target generator offers that cell and arrival accepts it. In an empty 100 by 100 container, a child requiring 150 units passes the fit gate and the default cellToPose shrinks it to the root dimensions.

Source and tests were left untouched.
