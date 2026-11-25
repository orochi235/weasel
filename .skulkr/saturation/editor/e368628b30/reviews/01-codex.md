# Review saturation for `editor`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 23 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Session write ordering, adapter failures, and rollback | 1 | 1 | 0 |
| 2 | Shell lifecycle and owned preferences stores | 1 | 2 | 0 |
| 3 | Snapshot migration, scene validation, and history restoration | 0 | 2 | 1 |
| 4 | Page editing, camera fitting and settling, grids, and guide overlays | 0 | 2 | 2 |
| 5 | Command dispatch, clipboard enablement, menu surfaces, and notices | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A failed dependent deletion can leave an old record beside a newly saved document

[sessionStore.ts](packages/editor/src/sessionStore.ts#L179) · Pass 1 · Medium · Source-traced

The removal phase ignores the false result from flushAll. If the older dependent cannot be deleted but the primary can be saved, writeSlots proceeds. If the replacement dependent also fails or the page closes after the primary write, storage can retain the old dependent beside the new primary. The generic writeSession API promises this intermediate pairing cannot occur. Paired undo history has its own read-side validation, but arbitrary dependents need not.

### 2. Opening shell preferences in Strict Mode leaves the discarded store subscribed

[editorPrefs.tsx](packages/editor/src/editorPrefs.tsx#L30) · Pass 2 · Low · Source-traced

With schema and storage options, the state initializer calls openPrefsSync. React development Strict Mode can invoke that initializer twice and keep only one result. The discarded store has already opened a record cache and registered a storage subscription when the adapter supports it, and no owner can close it or stop its version watcher.

Source and tests were left untouched.
