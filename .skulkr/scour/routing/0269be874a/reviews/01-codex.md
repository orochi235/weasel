# Review saturation for `routing`

Snapshot `0269be874a5adbbc9f6a3bd2b580f6a1dd1dea4f`. The tracked working tree was clean at the start of review. Scope is the 35 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Mixed-payload ingestion and drag preview | 1 | 1 | 0 |
| 2 | Compound preference menu writes and open-menu state | 1 | 2 | 0 |
| 3 | Contribution precedence, held modifiers and mode bindings | 0 | 2 | 1 |
| 4 | Eligibility predicates, selectors and conflict detection | 0 | 2 | 2 |
| 5 | Ambient subscriptions, viewport transforms and resize measurements | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A string item suppresses fallback files from the same transfer

[ingestItems.ts](packages/routing/src/ingestion/ingestItems.ts#L100) · Pass 1 · Medium · Source-traced

The materializer reads the fallback FileList only when it collected neither files nor strings. A transfer that exposes text in items and files only through files silently loses the files. The same decision in itemTypesFromDataTransfer can hide a pending file type and prevent a matching file-drop preview.

### 2. An open paint color row can restore stale paint fields

[compoundRows.ts](packages/routing/src/menus/compoundRows.ts#L207) · Pass 2 · Low · Source-traced

The color setter spreads the paint captured when the menu resolved. If opacity or another paint field changes while it is open, changing the color writes those old fields back. Compound object writers elsewhere in this module already use a current-value reader when writing.

Source and tests were left untouched.
