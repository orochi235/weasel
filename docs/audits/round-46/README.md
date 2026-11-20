# Audit round 46

Blind pairs at `6438325dbfdd7d007274232811abe60fc38c4f12` (2026-11-19), run by `scripts/skulk`. Each area's directory holds its file
list (`files.txt`), both reviewers' findings (`A.md`, `B.md`), the matching (`match.json`), the fixer's
report (`fix.md`) and the numbers below (`area.json`). The method is `docs/hardening.md`, "Blind pairs".

"Read" is how many listed files each reviewer says it read. "Est." is Chapman's estimate of what the area held,
"left" that less the distinct findings, and "last left" the previous pass's figure, which this pass tests.
"New code" counts findings citing a file changed since that pass. "Commits" is what the fixer committed.
"Tokens" adds input, output, cache creation and cache reads over the area's jobs; "cost" is list price.
One record per job is in `usage.jsonl`. The shas in `fix.md` are the fixer's, on its node; the same commits
as applied here are `fixCommits` in `area.json`.

| Area | Files | Read A/B | A | B | Shared | Distinct | Est. | Left | Last left | New code | Commits | Questions | Tokens | Cost | Branch |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| `diagram-formats` | 35 | 35/35 | 11 | 9 | 5 | 15 |  19.0 |   4.0 | - | - | 15 | 0 | 25.20M | $11.70 | `audit46-diagram-formats` |
| `diagram-formats.drawXml` | 14 | 14/14 | 7 | 9 | 2 | 14 |  25.7 |  11.7 | - | - | 14 | 1 | 2.65M | $7.07 | `audit46-diagram-formats.drawXml` |
| `diagram-formats.mermaid.part1` | 35 | 35/35 | 10 | 4 | 3 | 11 |  12.8 |   1.8 | - | - | 11 | 0 | 16.96M | $9.81 | `audit46-diagram-formats.mermaid.part1` |
| `diagram-formats.mermaid.part2` | 34 | 34/34 | 14 | 8 | 5 | 17 |  21.5 |   4.5 | - | - | 9 | 0 | 15.42M | $9.45 | `audit46-diagram-formats.mermaid.part2`, left out: merge conflict |
| `diagram.avoid` | 25 | 25/25 | 10 | 9 | 6 | 13 |  14.7 |   1.7 | - | - | 14 | 0 | 18.11M | $9.24 | `audit46-diagram.avoid` |
| `diagram.containers` | 12 | 12/12 | 7 | 4 | 1 | 10 |  19.0 |   9.0 | - | - | 12 | 0 | 18.00M | $8.44 | `audit46-diagram.containers` |
| `diagram.effect.part1` | 31 | 31/31 | 7 | 7 | 4 | 10 |  11.8 |   1.8 | - | - | 13 | 0 | 22.08M | $10.37 | `audit46-diagram.effect.part1` |
| `diagram.effect.part2` | 30 | 30/30 | 6 | 5 | 4 | 7 |   7.4 |   0.4 | - | - | 7 | 2 | 13.24M | $7.49 | `audit46-diagram.effect.part2`, left out: merge conflict |
| `diagram.hops` | 10 | 10/10 | 3 | 6 | 2 | 7 |   8.3 |   1.3 | - | - | 10 | 0 | 11.78M | $6.33 | `audit46-diagram.hops` |
| `diagram.layered` | 17 | 17/17 | 4 | 2 | 0 | 6 |  14.0 |   8.0 | - | - | 8 | 0 | 12.92M | $7.90 | `audit46-diagram.layered` |
| `diagram.outlines` | 11 | 11/11 | 2 | 2 | 0 | 4 |   8.0 |   4.0 | - | - | 3 | 0 | 4.04M | $3.21 | `audit46-diagram.outlines` |
| `diagram.part1` | 50 | 50/50 | 4 | 7 | 3 | 8 |   9.0 |   1.0 | - | - | 9 | 0 | 28.33M | $12.94 | `audit46-diagram.part1`, left out: merge conflict |
| `diagram.part2` | 50 | 49/50 | 2 | 6 | 2 | 6 |   6.0 |   0.0 | - | - | 8 | 1 | 23.17M | $10.67 | `audit46-diagram.part2` |
| `diagram.part3` | 48 | 48/48 | 4 | 6 | 2 | 8 |  10.7 |   2.7 | - | - | 8 | 0 | 18.83M | $9.34 | `audit46-diagram.part3` |
| `diagram.sequence` | 24 | 24/24 | 7 | 5 | 5 | 7 |   7.0 |   0.0 | - | - | 8 | 0 | 10.30M | $6.33 | `audit46-diagram.sequence` |
| `diagram.stencils` | 14 | 14/14 | 6 | 8 | 6 | 8 |   8.0 |   0.0 | - | - | 7 | 0 | 16.85M | $7.96 | `audit46-diagram.stencils` |

Totals: 151 distinct findings, 156 fix commits, 4 questions, 257.86M tokens, $138.25.

## Control sweep

The control sweep off (it runs only with --sweep).
