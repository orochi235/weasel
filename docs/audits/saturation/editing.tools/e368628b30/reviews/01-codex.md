# Review saturation for `editing.tools`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 34 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Bare-adapter point queries, stroke reach, and path geometry | 1 | 1 | 0 |
| 2 | Gesture routing and move operands across tool configurations | 1 | 2 | 0 |
| 3 | Shape insertion and live polygon and star option changes | 0 | 2 | 1 |
| 4 | Group entry, deferred selection, and modifier dispatch | 0 | 2 | 2 |
| 5 | Lasso options, eyedropper ordering, and pointer subscriptions | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Silhouette picking rejects visible stroke outside the pose box

[adapterPointQuery.ts](packages/editing/src/tools/select/adapterPointQuery.ts#L29) · Pass 1 · Medium · Source-traced

The fast bound expands only by pick tolerance. With a centered 10-unit stroke and tolerance 0, a click two units outside an unrotated rectangle’s pose box is on painted ink but returns before shapeCoversPoint can account for stroke reach. This affects the default bare-adapter picker in silhouette mode.

### 2. Dragging an unselected body can move unrelated selected nodes

[selectionContributions.ts](packages/editing/src/tools/select/selectionContributions.ts#L103) · Pass 2 · Medium · Source-traced

The ambient unselected-body binding assumes the select tool has run its pointer-down classifier. On a canvas with the move feature and an active tool that leaves the drag unclaimed but does not select on press, preselect A and drag distinct unselected B. The move binding accepts B’s press, while beginMove in packages/editing/src/actions/move/session.ts reads the unchanged operands and translates A. The analogous Alt-drag binding has the same dependency on select-on-press.

Source and tests were left untouched.
