# Review saturation for `ui.components.GradientEditor`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 14 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Controlled stop selection and editor inputs | 1 | 1 | 0 |
| 2 | Overlay gesture completion and preview lifetime | 1 | 2 | 0 |
| 3 | Stop insertion, removal, ordering, and focus restoration | 0 | 2 | 1 |
| 4 | Radial, linear, and conic handle geometry | 0 | 2 | 2 |
| 5 | Paint-kind adapters, SVG restrictions, and control holds | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An in-range fractional stop selection can crash the editor

[useStopSelection.ts](packages/ui/src/components/GradientEditor/useStopSelection.ts#L31) · Pass 1 · Low · Source-traced

The controlled `selectedStop` is a number. The selection hook promises to fall back to the first stop when the selection names no item, but checks only bounds. With at least two stops, a value of `0.5` passes, and `GradientStops` supplies `undefined` to `StopEditor`, which reads `stop.offset`. The editor should fall back as it does for an out-of-range selection.

### 2. Returning a dragged handle to its starting point can leave a preview open

[handleOverlay.tsx](packages/ui/src/components/GradientEditor/handleOverlay.tsx#L57) · Pass 2 · Medium · Source-traced

The overlay reports movement through `onInput`. If the user releases exactly at the starting value, the commit path clears its start marker and skips both commit and cancellation. A host that maintains an edit transaction from the first preview receives no end signal. If the pointerup is the first event back at the starting point, a commit-only consumer can also keep the preceding local preview because neither draft cleanup callback ran.

Source and tests were left untouched.
