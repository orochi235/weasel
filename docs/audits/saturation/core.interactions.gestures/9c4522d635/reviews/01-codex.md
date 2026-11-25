# Review saturation for `core.interactions.gestures`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 16 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Drag startup and cancellation reentrancy | 1 | 1 | 0 |
| 2 | Pointer drop targeting with custom ghosts | 1 | 2 | 0 |
| 3 | Rectangle reanchoring and end thresholds | 0 | 2 | 1 |
| 4 | Radial state, modifier propagation and projections | 0 | 2 | 2 |
| 5 | Resize handle spacing and screen tolerances | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Canceling in onGestureStart still calls onStart with cleared state

[dragGesture.ts](packages/core/src/interactions/gestures/dragGesture/dragGesture.ts#L124) · Pass 1 · Medium · Source-traced

Supply an onGestureStart callback that synchronously cancels the controller and an onStart callback that reads ctx.scratch. Cancel clears the state and closes the lifecycle. Start resumes and calls onStart with getters backed by the cleared state, so accessing the scratch throws.

### 2. A custom drag ghost can intercept its own drop

[pointerDrag.ts](packages/core/src/interactions/gestures/pointerDrag/pointerDrag.ts#L123) · Pass 2 · Medium · Source-traced

Return a fixed-position custom ghost centered under the pointer with default pointer events. Unlike the default ghost, the custom element is appended without disabling hit testing. elementFromPoint sees the ghost, so a drop zone underneath never receives the drop.

Source and tests were left untouched.
