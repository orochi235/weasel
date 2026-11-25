# Review saturation for `core.domains`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 34 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | File picker and imperative ingestion conversion | 1 | 1 | 0 |
| 2 | Pose publication, document switches and commits | 1 | 2 | 0 |
| 3 | Chrome rules and hover tracking | 0 | 2 | 1 |
| 4 | View pinning, marker transforms and presentation page targets | 0 | 2 | 2 |
| 5 | Mode activation, long-press paint and path-effect source filtering | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Imperative ingestion loses files from another browser realm

[useCanvasIngestion.ts](packages/core/src/domains/ingestion/useCanvasIngestion.ts#L106) · Pass 1 · Low · Source-traced

Pass a File constructed by a same-origin iframe to ingest. It fails the current window's instanceof check and reaches the action as a bare File with no IngestItem kind or mime. The registered handlers receive no normalized file item.

### 2. Stopping a pose run after a scene switch can write into the new document

[usePoseRun.ts](packages/core/src/domains/poseRun/usePoseRun.ts#L118) · Pass 2 · Medium · Source-traced

Start on scene A, publish one frame, then rerender with scene B that has a matching node id. Call stop before the next frame. The commit takes the current scene from options but iterates the previous scene's preview poses, writing A's pose into B. Only the next tick switches the hold.

Source and tests were left untouched.
