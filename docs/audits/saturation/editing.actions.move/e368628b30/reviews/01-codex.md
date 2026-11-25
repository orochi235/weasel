# Review saturation for `editing.actions.move`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 33 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Transformed layout containers and drop exit hit testing | 1 | 1 | 0 |
| 2 | Swap dwell lifecycle when its target changes before arming | 1 | 2 | 0 |
| 3 | Move capture, constraints, snapping, and final-frame handling | 0 | 2 | 1 |
| 4 | Page drops, reparenting, and descendant coordinate changes | 0 | 2 | 2 |
| 5 | Layout reflow, refusal overlays, and behavior commit ordering | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Layout exit detection uses an unturned box for rotated containers

[exits.ts](packages/editing/src/actions/move/layout/exits.ts#L32) · Pass 1 · Medium · Source-traced

Drag a child within the visible end of a rotated rectangular layout container whose strategy supplies no contains callback. The fallback tests the center against the pose's axis-aligned, unrotated bounds. A release inside the drawn container can therefore be classified as leaving it, and the inverse can also occur.

### 2. Swap dwell can arm a target removed while the timer was pending

[swapOnDrop.ts](packages/editing/src/actions/move/behaviors/swapOnDrop.ts#L133) · Pass 2 · Low · Source-traced

Rest the dragged object over a swap target, then remove that target through another edit before the dwell timer expires. The callback arms using the captured ID without checking the node or eligibility again; it can compute an armed preview for an absent target. The validity check at release comes after the timer has already tried to preview it.

Source and tests were left untouched.
