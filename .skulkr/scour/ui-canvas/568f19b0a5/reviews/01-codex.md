# Review saturation for `ui-canvas`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 38 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Plot table edit acceptance, row identity, and value controls | 1 | 1 | 0 |
| 2 | Selection panel draft restoration and edit routing | 0 | 1 | 1 |
| 3 | Layer-list movement, filtering, and annotation selection | 0 | 1 | 2 |
| 4 | Gradient action lifetime, ruler rendering, and inspector controls | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Rejected table edits accumulate in the mounted panel

[rowIds.ts](packages/ui-canvas/src/components/PlotDataPanel/rowIds.ts#L39) · Pass 1 · Low · Source-traced

The panel is controlled, and a host can decline an edit by keeping the same `data` object. Each attempted insert, removal, or move retains its proposed chart object and row shift in `pending`. Only a changed input data identity clears that array. A host that keeps the same chart while repeatedly declining these edits leaves the proposals retained for as long as the panel stays mounted with that chart. Declined edits should leave no growing backlog of chart snapshots.

Source and tests were left untouched.
