# Review saturation for `editing`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 42 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Clipboard cascade across adapters with deferred inserts | 1 | 1 | 0 |
| 2 | Clipboard flavor/write fallbacks and paste operation ordering | 0 | 1 | 1 |
| 3 | Boolean piece replacement, hierarchy, and undo ordering | 0 | 1 | 2 |
| 4 | Ingest handler lifecycle, preset dependencies, and selection hooks | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. The deferred-insert clipboard fallback can feed paste the wrong item shape

[clipboardOps.ts](packages/editing/src/clipboard/clipboardOps.ts#L77) · Pass 1 · Medium · Source-traced

Use a React-backed insert adapter whose snapshot items are world-space records and whose committed nodes store their poses relative to a parent. The immediate snapshot after dispatch is empty because state has not flushed, so the hook replaces the clipboard with locally positioned created nodes. The next paste consumes those as snapshot records and can place them relative to the wrong origin. The existing deferred-adapter test uses identical shapes and coordinates for both representations.

Source and tests were left untouched.
