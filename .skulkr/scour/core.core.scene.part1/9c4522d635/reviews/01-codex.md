# Review saturation for `core.core.scene.part1`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 40 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Derivation memo reads and dependency invalidation | 1 | 1 | 0 |
| 2 | Nested rollback logs and large batches | 1 | 2 | 0 |
| 3 | Layer ordering and layout arrivals and departures | 0 | 2 | 1 |
| 4 | Pose composition, carry frames, consumers and clipping | 0 | 2 | 2 |
| 5 | Edit passes, history facade, document values and registries | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| M1 | A second read of dependency children can erase the first read's invalidation evidence | [depMemo.ts](packages/core/src/core/scene/depMemo.ts#L74) | 1 | Medium | Source-traced |
| M2 | A large successful inner edit can fail while joining the outer rollback log | [appliedLog.ts](packages/core/src/core/scene/appliedLog.ts#L54) | 2 | Low | Source-traced |

- **M1.** Let a derivation read `dep.children[0].path` and later read `dep.children.length`. The second getter constructs a new child record at the same slot. It replaces the record that held the first read's path dependency. When that child's resolved path changes without the captured child pose or data changing, the outer memo can continue serving an obsolete derivation.
- **M2.** A nested atomic edit that does not own a history entry joins its log to the enclosing one. The join spreads the entire log as call arguments. A bulk edit over enough nodes can exceed the engine's argument limit after its mutations ran, turning the successful inner computation into a rollback and failure.

Source and tests were left untouched.
