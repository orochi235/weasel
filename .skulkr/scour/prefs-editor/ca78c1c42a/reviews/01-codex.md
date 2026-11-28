# Review saturation for `prefs-editor`

Snapshot `ca78c1c42a92855c2a3e72ac749e4854d9c29849`. The tracked working tree was clean at the start of review. Scope is the 10 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Clipboard value round-trip and asynchronous update ordering | 2 | 2 | 0 |
| 2 | Nested quantifier editing and empty-group representation | 0 | 2 | 1 |
| 3 | Field scope resolution, exclusions and comparison controls | 0 | 2 | 2 |
| 4 | Responsive layout, accessibility labels and editor entry points | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An outstanding clipboard read can overwrite a newer condition edit

[ConditionClipboard.tsx](packages/prefs-editor/src/PrefConditionEditor/ConditionClipboard.tsx#L36) · Pass 1 · P2 · Source-traced

Click Paste while readText remains pending, then edit a condition row before the clipboard read completes. When the earlier read resolves, the original callback still replaces the condition with its result. Two pastes resolving out of order have the same problem. A pending request can therefore discard an intervening user edit.

### 2. Copy reports success for numeric conditions that cannot round-trip

[ConditionClipboard.tsx](packages/prefs-editor/src/PrefConditionEditor/ConditionClipboard.tsx#L18) · Pass 1 · P3 · Source-traced

Copy a valid condition with an above value of Infinity. The condition validator permits the numeric value, but JSON.stringify writes it as null. Copy reports success and Paste then rejects the copied condition because an ordering bound must be a number. An equality comparison using Infinity is instead pasted as a null comparison, changing its meaning.

Source and tests were left untouched.
