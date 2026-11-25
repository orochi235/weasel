# Review saturation for `editing.actions.resize`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 14 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Resize finalization when the release point is newer than the preview | 1 | 1 | 0 |
| 2 | Custom commit errors and lifecycle reporting | 1 | 2 | 0 |
| 3 | Aspect constraints, minimum sizes, and output grid quantization | 0 | 2 | 1 |
| 4 | Held children, frame composition, and geometric projections | 0 | 2 | 2 |
| 5 | Transform replay, capture, and snapshot boundaries | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Resize commits an earlier pointer sample when the release has moved

[action.ts](packages/editing/src/actions/resize/action.ts#L61) · Pass 1 · Low · Source-traced

Deliver a drag move and then a release at a different point without an intervening move. onEnd ignores its supplied event and commits the preceding frame, even though the routing dispatcher has the newer coordinates. The recorded Transform Again scale also reflects the earlier size.

### 2. A throwing custom resize commit is reported as successful to the lifecycle

[action.ts](packages/editing/src/actions/resize/action.ts#L65) · Pass 2 · Low · Source-traced

Provide a custom resize commit callback that throws before writing. The action marks committed from preview count before invoking it, and its finally block passes true to closeRun. Lifecycle listeners can observe a successful commit even though the callback wrote nothing.

Source and tests were left untouched.
