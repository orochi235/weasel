# Review saturation for `ui.components.Badge.bases`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 14 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Polygon sampling and built-in corner degeneracies | 1 | 1 | 0 |
| 2 | Content fitting, clearance, and asymmetric insets | 0 | 1 | 1 |
| 3 | Spline anchors, endpoint handling, and sampling | 0 | 1 | 2 |
| 4 | Ribbon, rounded, puzzle, and Powerline perimeter geometry | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A fully chamfered square supplies a zero normal where its outline starts

[polygonSampler.ts](packages/ui/src/components/Badge/bases/polygonSampler.ts#L30) · Pass 1 · Low · Source-traced

A square chamfered-rectangle base with its chamfer set to half the side has coincident first and second vertices. Sampling at perimeter distance zero chooses that zero-length edge. The reported normal is `(0, 0)`, so an outline treatment that displaces this sample along the normal cannot apply its intended offset there. The sample should use a nondegenerate adjacent edge or corner normal.

Source and tests were left untouched.
