# Review saturation for `editing.actions`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 35 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Cut commit when the clipboard cannot copy the selection | 1 | 1 | 0 |
| 2 | Marquee finalization and the release event's world point | 1 | 2 | 0 |
| 3 | Alignment, distribution, transforms, and locked write gates | 0 | 2 | 1 |
| 4 | Selection, group navigation, pathfinder, and cloning | 0 | 2 | 2 |
| 5 | Reorder, swap placement, and undo operation ordering | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Cut deletes the selection even when copying produced nothing

[action.ts](packages/editing/src/actions/clipboard/action.ts#L60) · Pass 1 · Medium · Source-traced

Use an insert adapter that supports scene deletion but has no snapshotSelection method, or a copy callback that returns no items. The clipboard hook leaves the previous contents in place. Cut still commits the deletion because the copy call has no success check, so paste cannot restore what was just cut.

### 2. Marquee selection can commit the last move position instead of the release point

[areaSelect.ts](packages/editing/src/actions/select/areaSelect.ts#L90) · Pass 2 · Low · Source-traced

End a marquee drag at a different world point from the last delivered move, such as after event coalescing. The dispatcher supplies that final point in onEnd, but the action tests the rectangle from the old move sample. Objects covered only by the release rectangle are omitted.

Source and tests were left untouched.
