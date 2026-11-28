# Review saturation for `guides.guides`

Snapshot `407828d186fd5a27bcfa1e5b041eb375ef5eb864`. The tracked working tree was clean at the start of review. Scope is the 13 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | World bounds and per-node pose descriptors | 1 | 1 | 0 |
| 2 | Guide operations and undo ordering | 0 | 1 | 1 |
| 3 | Alignment and spacing candidate geometry | 0 | 1 | 2 |
| 4 | Overlay rendering, subscription, and guide store updates | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Guide bounds ignore node-specific pose descriptors

[sceneBounds.ts](packages/guides/src/guides/alignment/sceneBounds.ts#L40) · Pass 1 · Medium · Source-traced

worldBoundsOf uses the base descriptor for every node even when the supplied descriptor specializes via forNode. A custom node whose specialized bounds differ from its base pose contributes the wrong edges to siblingBounds and worldUnionOf, so callers can align to geometry different from what the canvas draws.

Source and tests were left untouched.
