# Review saturation for `core.core.viewport`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 23 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

This ledger carries forward V1–V13 from the [original viewport report](viewport-review-saturation-codex.md), which contains their locations, reproductions and evidence. The original pass 10 was verification and is excluded from this search ledger. The last two rows are fresh searches. The original run also verified 251 scoped tests.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | View invariants and anchored wheel zoom | 1 | 1 | 0 |
| 2 | World extents, clamping and fit contracts | 2 | 3 | 0 |
| 3 | Client projection and canvas measurement | 1 | 4 | 0 |
| 4 | Parallax and signed pick slop | 2 | 6 | 0 |
| 5 | Release velocity and coast boundaries | 2 | 8 | 0 |
| 6 | Interpolation, endpoints and scale ratios | 1 | 9 | 0 |
| 7 | Animator lifecycle and replacement | 2 | 11 | 0 |
| 8 | Overlay projection and freshness | 2 | 13 | 0 |
| 9 | Exported contracts, test coverage and callers | 0 | 13 | 1 |
| 10 | Camera cancellation and overlapping additive animation writes | 0 | 13 | 2 |
| 11 | Fit wrapper behavior, wheel routing and coordinate adapters | 0 | 13 | 3 |

Stopped after three consecutive passes with zero new defects.

No additional defects beyond V1–V13.

Source and tests were left untouched.
