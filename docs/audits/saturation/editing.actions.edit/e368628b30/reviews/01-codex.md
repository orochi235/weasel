# Review saturation for `editing.actions.edit`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 16 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Vertex-color channel validation before writing anchor data | 1 | 1 | 0 |
| 2 | Paint inheritance, previews, and commit behavior | 0 | 1 | 1 |
| 3 | Group and ungroup transforms, dependencies, and undo | 0 | 1 | 2 |
| 4 | Duplicate, nudge, selection commands, and ingestion handoff | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A sparse RGBA tuple can write undefined channels

[setVertexColor.ts](packages/editing/src/actions/edit/setVertexColor.ts#L16) · Pass 1 · Low · Source-traced

Pass a four-slot color array with one missing element from an extension or an untyped caller. Array.every skips the hole, so the validator accepts the array and Array.map preserves the gap. Spreading it into the splice writes undefined into the anchor's color, despite the command's contract to ignore colors missing any of four finite numbers.

Source and tests were left untouched.
