# Review saturation for `core.domains.snap`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 24 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Point candidate origin exclusion | 1 | 1 | 0 |
| 2 | Rotation source cache and shown pose | 1 | 2 | 0 |
| 3 | Span and point session ownership | 0 | 2 | 1 |
| 4 | Input constraints, resize and candidate resolution | 0 | 2 | 2 |
| 5 | Readout marks and plane mapping | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Origin exclusion grows with distance from the world origin

[gather.ts](packages/core/src/domains/snap/gather.ts#L115) · Pass 1 · Low · Source-traced

At a draw origin of (1000000000, 0), a candidate at (1000000000.5, 0) is removed as the same point. The exclusion is one world unit there, even at a zoom where the two positions are several screen pixels apart.

### 2. A rotation gesture keeps obsolete target angles during pose overrides

[rotationSource.ts](packages/core/src/domains/snap/rotationSource.ts#L16) · Pass 2 · Medium · Source-traced

Collect node rotation candidates during a rotate gesture, then animate a different eligible node via a shown pose override. The default rotation reader uses its shown pose, but per-gesture cache keys stay equal because only the override generation changed. The next rotate frame snaps against the old angle.

Source and tests were left untouched.
