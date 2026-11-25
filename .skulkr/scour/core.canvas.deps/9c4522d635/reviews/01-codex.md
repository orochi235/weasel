# Review saturation for `core.canvas.deps`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 30 files listed for this area in the working-tree [Skulkr partition](docs/audits/partition.json). The passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Entered group state and document changes | 1 | 1 | 0 |
| 2 | Preview ownership and canvas replacement | 1 | 2 | 0 |
| 3 | Path-edit commits, geometry frames and insertion placement | 0 | 2 | 1 |
| 4 | View, snap, pointer and region-query interfaces | 0 | 2 | 2 |
| 5 | Layout, debug, selection snapshot and registration lifetimes | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| D1 | Removing a reparented entered group can take the user into its former parent | [enteredGroup.ts](packages/core/src/canvas/deps/enteredGroup.ts#L47) | 1 | Medium | Source-traced |
| D2 | An overlapping preview can stay attached to a previous canvas API | [previewPaths.ts](packages/core/src/canvas/deps/previewPaths.ts#L23) | 2 | Low | Source-traced |

- **D1.** Enter child group X while it is under A. Reparent X under B without removing it, then delete X. The store captured `[X,A]` on entry, and the scene subscription checks only the current ID, so the reparent does not refresh its fallback chain. Deleting X enters A even though the last entered hierarchy was under B.
- **D2.** Call `show` with canvas A as the API, swap the getter to B, and call `show` again before the first cleanup. The retained detach callback makes the second call skip registering on B, while its redraw targets B. The newest preview can remain attached to A and be absent on B. Calling the first cleanup no longer detaches it because the second preview superseded its token.

Source and tests were left untouched.
