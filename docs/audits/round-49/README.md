# Audit round 49

Blind pairs at `2f3b11aab7ae249a1690ff9a4409dbdf440e5222` (2026-11-20), run by `scripts/skulk`. Each area's directory holds its file
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
| `geom.booleans` | 31 | 31/31 | 2 | 6 | 1 | 7 |   9.5 |   2.5 | - | - | 7 | 0 | 3.00M | $8.73 | `audit49-geom.booleans` |
| `geom.constraints` | 10 | 10/10 | 4 | 2 | 1 | 5 |   6.5 |   1.5 | - | - | 5 | 0 | 1.35M | $4.23 | `audit49-geom.constraints` |
| `geom.part1` | 42 | 42/42 | 4 | 4 | 1 | 7 |  11.5 |   4.5 | - | - | 8 | 0 | 3.59M | $10.20 | `audit49-geom.part1`, left out: merge conflict |
| `geom.part2` | 41 | 41/41 | 7 | 11 | 6 | 12 |  12.7 |   0.7 | - | - | 13 | 0 | 3.54M | $10.03 | `audit49-geom.part2` |
| `geom.paths.part1` | 37 | 37/37 | 2 | 4 | 0 | 6 |  14.0 |   8.0 | - | - | 6 | 0 | 2.24M | $7.02 | `audit49-geom.paths.part1` |
| `geom.paths.part2` | 36 | 36/36 | 7 | 7 | 3 | 11 |  15.0 |   4.0 | - | - | 13 | 2 | 3.54M | $10.24 | `audit49-geom.paths.part2` |
| `geom.tessellate` | 11 | 11/11 | 2 | 5 | 1 | 6 |   8.0 |   2.0 | - | - | 5 | 1 | 2.17M | $6.54 | `audit49-geom.tessellate` |
| `geom.warp` | 18 | 18/18 | 4 | 4 | 1 | 7 |  11.5 |   4.5 | - | - | 7 | 0 | 2.30M | $6.88 | `audit49-geom.warp`, left out: merge conflict |
| `gestures` | 43 | 43/43 | 6 | 5 | 2 | 9 |  13.0 |   4.0 | - | - | 9 | 0 | 2.60M | $7.68 | `audit49-gestures` |
| `guides` | 23 | 23/23 | 4 | 7 | 4 | 7 |   7.0 |   0.0 | - | - | 7 | 0 | 2.35M | $6.57 | `audit49-guides` |
| `guides.grid` | 12 | 12/12 | 5 | 4 | 2 | 7 |   9.0 |   2.0 | - | - | 6 | 0 | 1.43M | $4.38 | `audit49-guides.grid` |
| `guides.guides` | 12 | 12/12 | 3 | 2 | 1 | 4 |   5.0 |   1.0 | - | - | 3 | 0 | 1.58M | $4.67 | `audit49-guides.guides` |
| `guides.layout` | 13 | 13/13 | 4 | 5 | 2 | 7 |   9.0 |   2.0 | - | - | 8 | 0 | 2.55M | $7.39 | `audit49-guides.layout` |
| `headless` | 11 | 11/11 | 3 | 3 | 0 | 6 |  15.0 |   9.0 | - | - | 8 | 0 | 1.77M | $5.04 | `audit49-headless` |
| `history` | 17 | 17/17 | 8 | 7 | 5 | 10 |  11.0 |   1.0 | - | - | 12 | 0 | 2.53M | $7.13 | `audit49-history` |
| `hud` | 31 | 31/31 | 4 | 6 | 2 | 8 |  10.7 |   2.7 | - | - | 8 | 0 | 2.62M | $7.50 | `audit49-hud` |

Totals: 119 distinct findings, 125 fix commits, 3 questions, 39.17M weighted tokens, $114.23.

## Control sweep

The control sweep off (it runs only with --sweep).
