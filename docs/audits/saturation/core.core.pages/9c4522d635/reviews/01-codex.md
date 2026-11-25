# Review saturation for `core.core.pages`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 11 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Page placement and stale root membership | 1 | 1 | 0 |
| 2 | Page size validation and layout arithmetic | 1 | 2 | 0 |
| 3 | Page overlap ownership and tie-breaking | 1 | 3 | 0 |
| 4 | Legacy migration, page metadata and undo writes | 0 | 3 | 1 |
| 5 | Followers, grouping and coordinate rehoming | 0 | 3 | 2 |
| 6 | Page rendering, clipping, fit and navigation | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| P1 | A missing root ID passes the placement filter and throws later | [placeOnPages.ts](packages/core/src/core/pages/placeOnPages.ts#L99) | 1 | Low | Source-traced |
| P2 | Live page edits can construct layouts that the migration validator rejects | [pageEdits.ts](packages/core/src/core/pages/pageEdits.ts#L174) | 2 | Medium | Source-traced |
| P3 | Equal positive overlap favors a higher span instead of the earlier page | [pages.ts](packages/core/src/core/pages/pages.ts#L109) | 3 | Low | Source-traced |

- **P1.** In a paged scene, call `placeOnPages` with a previously captured root ID that has since been removed. `s.get(id)?.parent == null` accepts undefined, so placement forwards the missing ID to the destination reader. A missing node is then used as a real root while measuring its pose.
- **P2.** Resize a page to width NaN in a row layout with a later page. The edit passes the size to `layoutPages` without checking page dimensions. That width advances the layout cursor to NaN and can propagate into following page positions. The migration validator already treats non-finite or negative page dimensions as invalid. [Page validation](packages/core/src/core/pages/pageNodes.ts#L46)
- **P3.** Test a box covering two nonoverlapping pages of 10 × 10 and 20 × 5, in that order. Both positive overlap areas are 100. The overlap score orders by span as well, choosing the second page because 25 exceeds 20. The documented earlier-page tiebreak should hold for equal areas, with span reserved for degenerate overlap.

Source and tests were left untouched.
