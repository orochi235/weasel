# Review saturation for `ui.components.PanelCells`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 17 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Immutable path writes and preservation of array shape | 1 | 1 | 0 |
| 2 | Dynamic bounds, mixed selections, and equivalent schemas | 0 | 1 | 1 |
| 3 | Alias conditions, selection reads, and reset routing | 0 | 1 | 2 |
| 4 | Nested object fields, row rendering, and marked tabs | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Updating one array-backed property fills unrelated holes

[model.ts](packages/ui/src/components/PanelCells/model.ts#L268) · Pass 1 · Low · Source-traced

The path writer clones arrays using iterable spread. Editing index 1 of `[ , 'old']` creates an own property with value `undefined` at index 0, even though the edit never targeted it. The same conversion happens for an array nested along the path. Consumers that use a sparse array to distinguish absent entries from explicit `undefined` observe a change outside the edited property.

Source and tests were left untouched.
