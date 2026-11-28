# Review saturation for `labkit.controls`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 38 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Dialog draft ownership across closes and reopens | 1 | 1 | 0 |
| 2 | Matrix popover anchors and disabled mutation paths | 2 | 3 | 0 |
| 3 | Panel row placement, headings, and reset routing | 0 | 3 | 1 |
| 4 | Compound controls, field binding, and action context | 0 | 3 | 2 |
| 5 | Grid packing, field choice context, and control stories | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An old dialog callback can write into a newly opened draft

[DraftDialogRow.tsx](packages/labkit/src/controls/DraftDialogRow.tsx#L37) · Pass 1 · medium · Source-traced

A dialog body can retain its supplied setter or updater across an asynchronous operation. The guard is one boolean shared by every opening. If the first opening is canceled and the row is reopened before an old callback fires, open.current is true again, allowing that callback to replace the new draft or seed it from the old opening's value.

### 2. Removing an open matrix cell from the layout leaves its editor live

[ControlMatrix.tsx](packages/labkit/src/controls/ControlMatrix.tsx#L122) · Pass 2 · medium · Source-traced

Reconciliation checks whether the path is still visible in the schema but never checks whether its row and column remain in the props. Removing the column or row while leaving the underlying config schema intact keeps the editor open against the detached trigger and retains its ability to write the removed cell's setting.

### 3. Matrix popover actions can write after a cell becomes disabled

[MatrixPopover.tsx](packages/labkit/src/controls/MatrixPopover.tsx#L72) · Pass 2 · medium · Source-traced

The editor control rechecks isRowEnabled when config changes, but the Clear and Inherit buttons only check value and auto state. If an enableIf condition turns false while the popover is open, these buttons can still write null or AUTO even though the cell and its main editor are disabled.

Source and tests were left untouched.
