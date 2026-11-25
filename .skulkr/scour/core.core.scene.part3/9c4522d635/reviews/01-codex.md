# Review saturation for `core.core.scene.part3`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 40 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Replay after untracked dependency edits | 1 | 1 | 0 |
| 2 | Snapshot boundary and generic pose round-trip | 1 | 2 | 0 |
| 3 | World-pose localization across old and current saves | 0 | 2 | 1 |
| 4 | Scroll frame and document/session adapters | 0 | 2 | 2 |
| 5 | Render order, selection and edit notifications | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Redo can remove a source that has gained a dependent

[staleReplay.ts](packages/core/src/core/scene/staleReplay.ts#L75) · Pass 1 · Medium · Source-traced

Remove a source node and undo that removal. Add a dependent of the restored source in an untracked edit, then redo the removal. The replay guard checks current tree children but omits explicit dependents. The recorded removal deletes the source while leaving the new dependent pointing to it. Ordinary removal takes the dependency closure.

### 2. The snapshot reader rejects a null pose the scene can save

[snapshotShape.ts](packages/core/src/core/scene/snapshotShape.ts#L63) · Pass 2 · Low · Source-traced

A scene with a custom pose type that accepts null can store a mark with pose null. serializeNode copies it into the save. Loading that save rejects the field as missing, even though the scene's generic construction accepts that pose.

Source and tests were left untouched.
