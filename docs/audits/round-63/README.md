# Audit round 63

Blind pairs at `1b4edb3a93db1759496d564da57eb13020b3d7d2` (2026-11-21), run by skulkr. Each area's directory holds its file
list (`files.txt`), both reviewers' findings (`A.md`, `B.md`), the matching (`match.json`), the fixer's
report (`fix.md`) and the numbers below (`area.json`). The method is `docs/hardening.md`, "Blind pairs".

"Read" is how many listed files each reviewer says it read. "Est." is Chapman's estimate of what the area held,
"left" that less the distinct findings, and "last left" the previous pass's figure, which this pass tests.
"New code" counts findings citing a file changed since that pass. "Commits" is what the fixer committed.
"Weighted tokens" counts each kind of token at its price against an input token (`TOKEN_WEIGHTS` in skulkr's `src/usage.mjs`); "cost" is list price.
One record per job is in `usage.jsonl`. The shas in `fix.md` are the fixer's, on its node; the same commits
as applied here are `fixCommits` in `area.json`.

| Area | Files | Read A/B | A | B | Shared | Distinct | Est. | Left | Last left | New code | Commits | Questions | Weighted tokens | Cost | Branch |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| `apps.chart.src.part2` | 27 | 27/27 | 2 | 3 | 0 | 5 |  11.0 |   6.0 |   9.0 (r33) | 1 in 5 changed | 5 | 0 | 1.58M | $4.63 | `audit63-apps.chart.src.part2` |
| `apps.draw.src.part1` | 38 | 38/38 | 4 | 3 | 1 | 6 |   9.0 |   3.0 |   8.0 (r35) | 0 in 6 changed | 6 | 0 | 4.12M | $10.98 | `audit63-apps.draw.src.part1`, left out: merge conflict |
| `core.canvas.part1` | 50 | 50/50 | 3 | 3 | 0 | 6 |  15.0 |   9.0 |   9.0 (r40) | 3 in 13 changed | 7 | 0 | 3.92M | $11.12 | `audit63-core.canvas.part1` |
| `diagram-formats.drawXml` | 14 | 14/14 | 8 | 7 | 3 | 12 |  17.0 |   5.0 |  11.7 (r46) | 1 in 1 changed | 13 | 0 | 2.65M | $7.88 | `audit63-diagram-formats.drawXml`, left out: merge conflict |
| `editing.actions` | 35 | 35/35 | 6 | 4 | 2 | 8 |  10.7 |   2.7 |  12.0 (r47) | 1 in 3 changed | 11 | 0 | 4.31M | $11.87 | left out: verify still failing after 2 repairs (1 of 357 test files failed) |
| `font` | 42 | 42/42 | 3 | 5 | 2 | 6 |   7.0 |   1.0 |  16.0 (r47) | 0 in 0 changed | 7 | 0 | 2.38M | $7.41 | `audit63-font`, left out: merge conflict |
| `headless` | 11 | 11/11 | 5 | 5 | 2 | 8 |  11.0 |   3.0 |   9.0 (r49) | 0 in 0 changed | 7 | 0 | 1.98M | $5.83 | `audit63-headless` |
| `labkit.lab.part2` | 30 | 30/30 | 5 | 3 | 0 | 8 |  23.0 |  15.0 |  12.0 (r50) | 3 in 10 changed | 8 | 0 | 3.32M | $9.15 | `audit63-labkit.lab.part2` |
| `labkit.surface` | 11 | 11/11 | 3 | 6 | 2 | 7 |   8.3 |   1.3 |  14.0 (r51) | 0 in 0 changed | 7 | 0 | 1.36M | $4.21 | `audit63-labkit.surface` |
| `pdf` | 28 | 28/28 | 7 | 2 | 2 | 7 |   7.0 |   0.0 |   9.0 (r53) | 0 in 0 changed | 8 | 0 | 4.15M | $12.14 | left out: verify still failing after 2 repairs (8 of 525 test files failed) |
| `renderer.draw` | 35 | 35/35 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |   9.0 (r54) | 0 in 1 changed | 6 | 0 | 4.30M | $12.32 | `audit63-renderer.draw`, left out: merge conflict |
| `svg.part2` | 44 | 44/44 | 7 | 10 | 2 | 15 |  28.3 |  13.3 |   7.5 (r55) | 3 in 2 changed | 15 | 0 | 2.96M | $15.58 | `audit63-svg.part2`, left out: merge conflict |

Totals: 93 distinct findings, 100 fix commits, 0 questions, 37.04M weighted tokens, $113.12.

## Control sweep

The control sweep off (it runs only with --sweep).
