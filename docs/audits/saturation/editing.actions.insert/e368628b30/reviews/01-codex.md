# Review saturation for `editing.actions.insert`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 14 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Selection restoration when insert setup fails early | 1 | 1 | 0 |
| 2 | Click placement validation for nonfinite dimensions | 1 | 2 | 0 |
| 3 | Snap sessions, frame shaping, and repositioning | 0 | 2 | 1 |
| 4 | Behavior commit, cancel, and replay lifecycle | 0 | 2 | 2 |
| 5 | Shape extent handling, style extras, and quantized landing | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A throwing insert-parent or snap hook leaves the original selection cleared

[session.ts](packages/editing/src/actions/insert/session.ts#L100) · Pass 1 · Low · Source-traced

Start a shape draw with a selection and a custom parent resolver that throws. beginInsert clears the selection before asking for the parent and only guards the later behavior start calls. The dispatcher catches the setup error, but no insert session reaches its cancel handler and the original selection is lost.

### 2. Click placement accepts an infinite requested size

[placeAction.ts](packages/editing/src/actions/insert/placeAction.ts#L55) · Pass 2 · Low · Source-traced

Invoke Place with a finite click point and a positive infinite width. The positive-size gate accepts Infinity, and the action constructs an infinite end coordinate and passes the resulting geometry to the insert adapter. The click path should refuse a nonfinite extent before calling the adapter.

Source and tests were left untouched.
