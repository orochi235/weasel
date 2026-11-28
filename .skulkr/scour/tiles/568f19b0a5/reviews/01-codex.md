# Review saturation for `tiles`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean. Scope is the five files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Stream priority and generic view inputs | 1 | 1 | 0 |
| 2 | Plane coverage, level selection, and floor bounds | 1 | 2 | 0 |
| 3 | Deferred bakes and invalidation | 0 | 2 | 1 |
| 4 | Draw fallback hierarchy, compositing, and fades | 0 | 2 | 2 |
| 5 | Cache ownership, eviction, and byte accounting | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Tile streaming ignores a valid falsy look-ahead view

[stream.ts](packages/tiles/src/stream.ts#L78) · Pass 1 · Low · Source-traced

The generic view type permits numeric views. With a scheme that uses numeric positions, `update(5, 0)` skips the declared look-ahead view because the optional argument is checked for truthiness. Tiles at position zero are never prefetched by that call, despite a supplied destination.

### 2. An aligned box can get a coarser pinned floor than specified

[scheme.ts](packages/tiles/src/scheme.ts#L148) · Pass 2 · Low · Verified by a read-only Node probe

`planeFloor` subtracts a level without checking whether the finer grid already fits the tile limit. With tile size 512, a two-tile limit per side, and bounds `[0, 0, 512, 512]`, it returns a single level-0 tile. The level-1 grid covers the same bounds with two tiles per side, so the documented finest fitting floor is level 1. The lower floor gives a less detailed stand-in.

Source and tests were left untouched.
