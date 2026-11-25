# Review saturation for `apps.ui-lab`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 28 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Spline scroll accumulation across anchor insertion and removal | 1 | 1 | 0 |
| 2 | Spline projection, drag constraints and mirrored endpoints | 0 | 1 | 1 |
| 3 | Badge composition, snippet rendering and effect parameters | 0 | 1 | 2 |
| 4 | Lab routing, state keys and app build configuration | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A replacement spline anchor inherits the removed anchor's partial wheel turn

[splineActions.ts](apps/ui-lab/src/badge/compose/splineActions.ts#L157) · Pass 1 · Low · Source-traced

Scroll part of one notch over an interior anchor, remove it, then scroll over the next anchor now occupying the same index. Carry is keyed only by the array index and persists through anchor edits. The replacement dot can change weight before it has received a full notch of its own.

Source and tests were left untouched.
