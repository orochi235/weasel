# Review saturation for `diagram.part1`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 39 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Deletion reporting through nested region and group membership | 1 | 1 | 0 |
| 2 | Batched edit delivery when callbacks change in the same task | 1 | 2 | 0 |
| 3 | Connector targets, snapping, and gesture preview | 0 | 2 | 1 |
| 4 | Body layout, row updates, and cluster placement | 0 | 2 | 2 |
| 5 | Diagram view fit, page splits, styles, and tool registration | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Deleting a region can omit its diagram descendants behind a plain group

[diagramEditing.ts](packages/diagram/src/diagramEditing.ts#L39) · Pass 1 · Medium · Source-traced

Place a plain group inside a container and a diagram shape inside that group. Core deletion of the container takes the shape with its ancestors. The reporting path recurses through region children only, so it never reports that nested shape or connectors attached to it. A host applying the report leaves orphaned data that the canvas deletion would have removed.

### 2. A batched edit can be delivered to a replacement callback

[batchedEdits.ts](packages/diagram/src/batchedEdits.ts#L35) · Pass 2 · Low · Source-traced

Report a move, then synchronously replace the view's onEdit handler before the queued microtask runs, such as when the immediate move callback switches documents. The batch is delivered through latest.current.onEdit, so the replacement handler can apply an edit generated for the previous document. If the replacement clears onEdit, the batch vanishes.

Source and tests were left untouched.
