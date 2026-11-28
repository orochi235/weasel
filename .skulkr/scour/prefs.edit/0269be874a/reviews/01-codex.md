# Review saturation for `prefs.edit`

Snapshot `0269be874a5adbbc9f6a3bd2b580f6a1dd1dea4f`. The tracked working tree was clean at the start of review. Scope is the 44 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Draft persistence for mixed literal and code attributes | 1 | 1 | 0 |
| 2 | Structural edits, aliases, value path rebasing and asset dependencies | 0 | 1 | 1 |
| 3 | Condition row transformations, catalog checks and bundle export | 0 | 1 | 2 |
| 4 | Three-way carry, origin tracking, submission and history restoration | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Draft packing discards edits to attributes that also contain code

[draft.ts](packages/prefs/src/edit/draft.ts#L107) · Pass 1 · P2 · Source-traced

Use a numeric preference with a function-backed custom unit and edit a serializable field beside its functions, such as the unit suffix, by replacing the unit object while retaining toDisplay and fromDisplay. The replacement is not in the source identity map, and because any nested function marks the entire value as code, the draft stores only a reference to the original unit attribute. Reopening restores the old suffix along with the functions, losing the saved edit.

Source and tests were left untouched.
