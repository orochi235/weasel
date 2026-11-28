# Review saturation for `plot.part1`

Snapshot `ca78c1c42a92855c2a3e72ac749e4854d9c29849`. The tracked working tree was clean at the start of review. Scope is the 45 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Plot text close and handle interaction against scene state | 2 | 2 | 0 |
| 2 | Gantt date formats, dependency scheduling and endpoint edits | 0 | 2 | 1 |
| 3 | Git graph replay and structural edits, journey step layout and packet row boundaries | 0 | 2 | 2 |
| 4 | Axis and mark geometry, clipping, schema dispatch and public entry points | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Closing an unchanged plot text editor can undo an unrelated scene edit

[textEdit.ts](packages/plot/src/editing/textEdit.ts#L55) · Pass 1 · P2 · Source-traced

Load a GitGraphData commit tag containing surrounding spaces, make an unrelated scene edit, then open its tag editor and dismiss it without writing a text change. The text editor calls its onEnd hook even when it writes nothing. The compiled tag preserves the raw spaces, but the tag setter trims them, so foldPlotText gets a new plot spec and unconditionally calls scene.undo before committing it. It can undo the unrelated edit and normalize the tag even after cancellation.

### 2. Hidden plot marks still offer exclusive drag handles

[handleLayer.ts](packages/plot/src/editing/handleLayer.ts#L91) · Pass 1 · P2 · Source-traced

Hide one draggable plot mark while leaving its root visible. plotHandles checks visibility and locking of the root only and emits handles for every child with a compatible plot mark. A hidden bar or Gantt span can still claim the pointer over its old area and mutate chart data when dragged.

Source and tests were left untouched.
