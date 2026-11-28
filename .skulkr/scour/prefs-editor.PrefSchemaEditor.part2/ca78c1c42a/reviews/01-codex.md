# Review saturation for `prefs-editor.PrefSchemaEditor.part2`

Snapshot `ca78c1c42a92855c2a3e72ac749e4854d9c29849`. The tracked working tree was clean at the start of review. Scope is the 36 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Document initialization, submission ordering and draft acknowledgment | 2 | 2 | 0 |
| 2 | Asset changes, selection restore and fold persistence | 0 | 2 | 1 |
| 3 | Preview drag, tree drop and held placement lifecycle | 0 | 2 | 2 |
| 4 | Attribute forms, scoped paths, row labels and picker navigation | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A host acknowledgment can arrive before the editor records its submission

[useDocument.ts](packages/prefs-editor/src/PrefSchemaEditor/useDocument.ts#L102) · Pass 1 · P2 · Source-traced

Let an asynchronous submission callback update the host baseline and set taken=true while its promise is still pending. The taken effect runs before send has recorded the packed submission and returns. Resolving the promise later only updates a ref and draft storage, so the effect does not retry while taken remains true. The draft and undo history miss the acknowledgment reconciliation.

### 2. Schema editor rendering requires a browser-side history snapshot

[useDocument.ts](packages/prefs-editor/src/PrefSchemaEditor/useDocument.ts#L64) · Pass 1 · P3 · Source-traced

Server-render the public AssetEditor, which calls useDocument during render. Its history subscription passes no getServerSnapshot to useSyncExternalStore. React rejects the render before it can output the editor, even for a controlled asset set with no stored draft.

Source and tests were left untouched.
