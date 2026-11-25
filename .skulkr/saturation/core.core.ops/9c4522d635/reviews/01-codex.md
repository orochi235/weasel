# Review saturation for `core.core.ops`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 24 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Arrangement history and coalescing identity | 1 | 1 | 0 |
| 2 | Multi-parent reorder failure and adapter contracts | 1 | 2 | 0 |
| 3 | Delete cascade capture, insert restoration and sibling anchors | 0 | 2 | 1 |
| 4 | Reparent, selection and no-op apply behavior | 0 | 2 | 2 |
| 5 | Field setters, factories and history replay | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| O1 | Arrangement coalescing keys can identify different sets of nodes as one edit | [arrange.ts](packages/core/src/core/ops/arrange.ts#L44) | 1 | Low | Source-traced |
| O2 | A failed multi-parent order write can leave earlier parents reordered on the plain adapter path | [setChildOrder.ts](packages/core/src/core/ops/reorder/setChildOrder.ts#L38) | 2 | Medium | Source-traced |

- **O1.** Arrange the nodes with IDs `a,b` and `c`, then separately arrange `a` and `b,c`. Both sorted ID sets produce the same comma-joined coalescing key. In a coalescing history window the two edits can share one undo step despite targeting different nodes. String IDs permit commas and the key does not escape or encode them.
- **O2.** Supply two parent orders through the default adapter application path. The first is valid, but the second includes an ID that the adapter rejects. The first write has already happened when the second throws. The op has no preflight or rollback, and the plain `applyOpsTo` path simply forwards the exception. An adapter with its own transactional batch can avoid this partial result. [Default application](packages/core/src/core/applyOps.ts#L11)

Source and tests were left untouched.
