# Review saturation for `apps.chart.src.part1`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 28 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Native document save/open and locked subtree restoration | 1 | 1 | 0 |
| 2 | Page selection, templates and fit sizing | 0 | 1 | 1 |
| 3 | Import/export command flow and warnings | 0 | 1 | 2 |
| 4 | Sequence edits, stencil and plot selection wiring | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. File Open cannot restore a saved locked group with children

[chartPersistence.ts](apps/chart/src/chartPersistence.ts#L75) · Pass 1 · Medium · Source-traced

Save a native chart containing a group that was locked after its children were inserted, then open the file. Replacement bypasses locks only for removal. It adds the locked group before its children, and the normal add path refuses an insertion under that group. The open fails for a document the app can save.

Source and tests were left untouched.
