# Review saturation for `labkit.part2`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 32 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Undo timestamp retention and saved history branches | 1 | 1 | 0 |
| 2 | Clean URL agreement with the page switcher | 1 | 2 | 0 |
| 3 | Ruler projection, guide snapping, and visibility | 0 | 2 | 1 |
| 4 | Overview composition, tool selection, and undo key bindings | 0 | 2 | 2 |
| 5 | Styles, themes, and testing entry points | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Stamp pruning drops timestamps for history branches that can still be reopened

[historyStamps.ts](packages/labkit/src/undo/historyStamps.ts#L20) · Pass 1 · medium · Source-traced

Once the cleanup threshold is reached, pruning keeps only IDs on the active undo and redo stacks. A retained branch can still contain the omitted entries. Switching to that branch makes stampOf fall back to the rounded history timestamp, potentially changing how those entries are ordered against annotation edits made in the same millisecond.

### 2. The page switcher generates dotted paths the test for clean routes rejects

[labRoutes.ts](packages/labkit/src/vite/labRoutes.ts#L44) · Pass 2 · low · Source-traced

The switcher strips the final .html from any relative HTML filename, so report.v2.html links to report.v2. The dev and preview middleware reject report.v2 because extname is nonempty, even though report.v2.html exists. The switcher's link therefore falls through instead of serving that page.

Source and tests were left untouched.
