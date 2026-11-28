# Review saturation for `path-tools.pen`

Snapshot `ca78c1c42a92855c2a3e72ac749e4854d9c29849`. The tracked working tree was clean at the start of review. Scope is the 12 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Closing and joining across gesture dispatch, constraint refusal and commit | 2 | 2 | 0 |
| 2 | Continuation direction, source geometry and compound subpaths | 0 | 2 | 1 |
| 3 | Point targeting, handle modifiers and snapping lifecycle | 0 | 2 | 2 |
| 4 | Scratch reset, preview rendering, tool options and harness contracts | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Closing a pen path with a handle drag can discard the drawing

[penActions.ts](packages/path-tools/src/pen/penActions.ts#L204) · Pass 1 · P2 · Source-traced

With auto-commit enabled, place three anchors, then press the first anchor and drag out its handle to close the path. The gesture dispatcher gives onEnd an invocation context with empty deps. The closing branch calls closeCurrent with those deps, so commitPen has no insert service, inserts nothing and clears the scratch. For a continued path the same branch lacks editAnchors, so it drops the pending edit.

### 2. A refused continuation join can still delete the other path

[penJoin.ts](packages/path-tools/src/pen/penJoin.ts#L70) · Pass 1 · P1 · Source-traced

Continue one existing path and land on an endpoint of a different node while the anchor edit service refuses the replacement geometry, for example because its finishing constraints cannot hold. editOps returns an empty array. commitJoin still appends the other node's delete op and submits the batch, so the other path disappears while the continued path retains its old geometry.

Source and tests were left untouched.
