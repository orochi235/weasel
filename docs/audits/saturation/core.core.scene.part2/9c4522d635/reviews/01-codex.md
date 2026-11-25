# Review saturation for `core.core.scene.part2`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 40 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Spec replacement and reconciliation | 1 | 1 | 0 |
| 2 | Override holds, removal logging and feed deltas | 0 | 1 | 1 |
| 3 | Node gates, lock guard and settlement | 0 | 1 | 2 |
| 4 | Layout frames, quantization and path-effect memo keys | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Replacing a node resets live edits to unchanged descendants

[reconcileSpecs.ts](packages/core/src/core/scene/reconcileSpecs.ts#L54) · Pass 1 · Medium · Source-traced

Create a group and child from specs, drag the child, then reconcile a new spec list changing only the group's layout function. The removal closure includes the child. The re-add uses its original spec and resets the drag even though its pose field is unchanged between spec lists. Reconciliation promises to preserve intervening edits to unchanged fields.

Source and tests were left untouched.
