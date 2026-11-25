# Audit round 47

Blind pairs at `44e73a944bea29d4d56fc7883fa302daec48ecf1` (2026-11-20), run by `scripts/skulk`. Each area's directory holds its file
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
| `diagram.theme` | 10 | 10/10 | 7 | 4 | 1 | 10 |  19.0 |   9.0 | - | - | 10 | 2 | 13.88M | $6.99 | `audit47-diagram.theme` |
| `dither` | 15 | 15/15 | 1 | 2 | 1 | 2 |   2.0 |   0.0 | - | - | 2 | 0 | 3.47M | $2.97 | `audit47-dither` |
| `editing` | 42 | 42/42 | 6 | 6 | 3 | 9 |  11.3 |   2.3 | - | - | 10 | 0 | 21.26M | $10.02 | `audit47-editing` |
| `editing.actions` | 34 | 34/34 | 5 | 7 | 1 | 11 |  23.0 |  12.0 | - | - | 12 | 0 | 9.88M | $11.45 | `audit47-editing.actions` |
| `editing.actions.edit` | 14 | 14/14 | 5 | 3 | 1 | 7 |  11.0 |   4.0 | - | - | 7 | 0 | 11.61M | $6.23 | `audit47-editing.actions.edit`, left out: merge conflict |
| `editing.actions.insert` | 14 | 14/14 | 5 | 4 | 1 | 8 |  14.0 |   6.0 | - | - | 10 | 0 | 20.64M | $9.09 | `audit47-editing.actions.insert` |
| `editing.actions.move` | 33 | 33/33 | 6 | 7 | 4 | 9 |  10.2 |   1.2 | - | - | 12 | 0 | 24.91M | $11.09 | `audit47-editing.actions.move` |
| `editing.actions.resize` | 14 | 14/14 | 5 | 4 | 2 | 7 |   9.0 |   2.0 | - | - | 7 | 0 | 9.09M | $5.48 | `audit47-editing.actions.resize` |
| `editing.chrome` | 10 | 10/10 | 3 | 2 | 1 | 4 |   5.0 |   1.0 | - | - | 4 | 0 | 8.33M | $4.84 | `audit47-editing.chrome` |
| `editing.presets` | 12 | 12/12 | 1 | 0 | 0 | 1 |   1.0 |   0.0 | - | - | 0 | 1 | 6.53M | $3.67 | no commits |
| `editing.tools` | 34 | 34/34 | 4 | 2 | 2 | 4 |   4.0 |   0.0 | - | - | 5 | 0 | 9.15M | $5.24 | `audit47-editing.tools` |
| `editor` | 22 | 22/22 | 4 | 3 | 2 | 5 |   5.7 |   0.7 | - | - | 5 | 0 | 8.02M | $5.21 | `audit47-editor` |
| `export` | 12 | 12/12 | 5 | 4 | 3 | 6 |   6.5 |   0.5 | - | - | 6 | 0 | 7.62M | $4.31 | `audit47-export` |
| `font` | 42 | 42/42 | 10 | 8 | 2 | 16 |  32.0 |  16.0 | - | - | 14 | 0 | 29.95M | $12.98 | `audit47-font` |
| `font.outline` | 13 | 13/13 | 5 | 6 | 3 | 8 |   9.5 |   1.5 | - | - | 9 | 0 | 16.21M | $8.28 | `audit47-font.outline` |
| `forge` | 28 | 28/28 | 4 | 9 | 1 | 12 |  24.0 |  12.0 | - | - | 8 | 0 | 8.48M | $4.77 | `audit47-forge` |

Totals: 119 distinct findings, 121 fix commits, 3 questions, 209.03M tokens, $112.62.

## Control sweep

The control sweep off (it runs only with --sweep).
