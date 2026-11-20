# Audit round 53

Blind pairs at `830b463cc110fc3f5182a03383bb1d182067d8e3` (2026-11-20), run by `scripts/skulk`. Each area's directory holds its file
list (`files.txt`), both reviewers' findings (`A.md`, `B.md`), the matching (`match.json`), the fixer's
report (`fix.md`) and the numbers below (`area.json`). The method is `docs/hardening.md`, "Blind pairs".

"Read" is how many listed files each reviewer says it read. "Est." is Chapman's estimate of what the area held,
"left" that less the distinct findings, and "last left" the previous pass's figure, which this pass tests.
"New code" counts findings citing a file changed since that pass. "Commits" is what the fixer committed.
"Weighted tokens" counts each kind of token at its price against an input token (`TOKEN_WEIGHTS` in `scripts/skulk/usage.mjs`); "cost" is list price.
One record per job is in `usage.jsonl`. The shas in `fix.md` are the fixer's, on its node; the same commits
as applied here are `fixCommits` in `area.json`.

| Area | Files | Read A/B | A | B | Shared | Distinct | Est. | Left | Last left | New code | Commits | Questions | Weighted tokens | Cost | Branch |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| `menu` | 15 | 15/15 | 1 | 1 | 0 | 2 |   3.0 |   1.0 | - | - | 2 | 0 | 1.09M | $3.40 | `audit53-menu` |
| `minimap` | 10 | 10/10 | 4 | 3 | 2 | 5 |   5.7 |   0.7 | - | - | 5 | 0 | 1.66M | $4.83 | `audit53-minimap` |
| `modes` | 9 | 9/9 | 2 | 2 | 1 | 3 |   3.5 |   0.5 | - | - | 3 | 0 | 0.87M | $2.56 | `audit53-modes` |
| `p-touch` | 10 | 10/10 | 7 | 6 | 2 | 11 |  17.7 |   6.7 | - | - | 14 | 0 | 2.23M | $6.43 | `audit53-p-touch` |
| `paint` | 32 | 32/32 | 6 | 5 | 2 | 9 |  13.0 |   4.0 | - | - | 10 | 0 | 1.67M | $5.10 | `audit53-paint` |
| `paint-kinds` | 13 | 13/13 | 5 | 4 | 2 | 7 |   9.0 |   2.0 | - | - | 7 | 0 | 1.10M | $3.29 | `audit53-paint-kinds` |
| `path-tools.part1` | 37 | 37/36 | 4 | 5 | 1 | 8 |  14.0 |   6.0 | - | - | 7 | 2 | 2.67M | $7.70 | `audit53-path-tools.part1` |
| `path-tools.part2` | 37 | 37/37 | 7 | 5 | 2 | 10 |  15.0 |   5.0 | - | - | 10 | 0 | 2.58M | $7.45 | `audit53-path-tools.part2` |
| `path-tools.part3` | 35 | 35/35 | 5 | 4 | 3 | 6 |   6.5 |   0.5 | - | - | 6 | 0 | 2.26M | $6.67 | `audit53-path-tools.part3` |
| `path-tools.pathEdit` | 18 | 18/18 | 7 | 5 | 3 | 9 |  11.0 |   2.0 | - | - | 10 | 0 | 2.52M | $7.22 | `audit53-path-tools.pathEdit` |
| `path-tools.pen` | 12 | 12/12 | 3 | 4 | 3 | 4 |   4.0 |   0.0 | - | - | 4 | 0 | 1.23M | $3.81 | `audit53-path-tools.pen` |
| `pdf` | 28 | 28/28 | 3 | 3 | 0 | 6 |  15.0 |   9.0 | - | - | 6 | 0 | 2.96M | $8.54 | `audit53-pdf` |
| `plot.part1` | 44 | 44/44 | 7 | 8 | 5 | 10 |  11.0 |   1.0 | - | - | 11 | 0 | 2.36M | $7.11 | `audit53-plot.part1` |
| `plot.part2` | 44 | 44/44 | 6 | 3 | 2 | 7 |   8.3 |   1.3 | - | - | 8 | 0 | 2.20M | $6.61 | `audit53-plot.part2` |
| `prefs` | 37 | 37/37 | 6 | 8 | 3 | 11 |  14.8 |   3.8 | - | - | 10 | 0 | 3.28M | $9.24 | `audit53-prefs` |
| `prefs-editor` | 10 | 10/10 | 5 | 3 | 2 | 6 |   7.0 |   1.0 | - | - | 6 | 0 | 1.22M | $3.64 | `audit53-prefs-editor` |

Totals: 114 distinct findings, 119 fix commits, 2 questions, 31.91M weighted tokens, $93.60.

## Control sweep

The control sweep off (it runs only with --sweep).
