# Audit round 59

Blind pairs at `6f634fabe1ba54c5d94054a307392fe6d65141ab` (2026-11-20), run by `scripts/skulk`. Each area's directory holds its file
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
| `ui.components.NumberField` | 10 | 10/10 | 4 | 3 | 2 | 5 |   5.7 |   0.7 | - | - | 5 | 0 | 0.55M | $2.99 | `audit59-ui.components.NumberField` |
| `ui.components.PanelCells` | 16 | 16/16 | 4 | 6 | 3 | 7 |   7.8 |   0.8 | - | - | 6 | 0 | 2.33M | $6.68 | `audit59-ui.components.PanelCells` |
| `ui.components.Prefs.part1` | 40 | 39/40 | 5 | 6 | 4 | 7 |   7.4 |   0.4 | - | - | 7 | 0 | 2.71M | $7.66 | `audit59-ui.components.Prefs.part1` |
| `ui.components.Prefs.part2` | 39 | 39/39 | 6 | 5 | 4 | 7 |   7.4 |   0.4 | - | - | 8 | 0 | 3.32M | $9.06 | `audit59-ui.components.Prefs.part2` |
| `ui.components.Properties.part1` | 37 | 37/37 | 7 | 9 | 5 | 11 |  12.3 |   1.3 | - | - | 11 | 0 | 3.10M | $8.75 | `audit59-ui.components.Properties.part1` |
| `ui.components.Properties.part2` | 36 | 36/36 | 6 | 7 | 2 | 11 |  17.7 |   6.7 | - | - | 11 | 0 | 2.42M | $6.98 | `audit59-ui.components.Properties.part2` |
| `ui.components.Segmented` | 12 | 12/12 | 6 | 7 | 3 | 10 |  13.0 |   3.0 | - | - | 10 | 0 | 2.62M | $7.35 | `audit59-ui.components.Segmented` |
| `ui.components.Select` | 10 | 10/10 | 5 | 6 | 2 | 9 |  13.0 |   4.0 | - | - | 10 | 0 | 2.01M | $5.74 | `audit59-ui.components.Select` |
| `ui.components.Slider` | 40 | 40/40 | 4 | 11 | 4 | 11 |  11.0 |   0.0 | - | - | 11 | 0 | 3.35M | $9.45 | `audit59-ui.components.Slider` |
| `ui.components.SwatchStrip` | 10 | 10/10 | 2 | 1 | 0 | 3 |   5.0 |   2.0 | - | - | 3 | 0 | 0.92M | $2.86 | `audit59-ui.components.SwatchStrip` |
| `ui.components.Timeline` | 18 | 18/18 | 8 | 7 | 4 | 11 |  13.4 |   2.4 | - | - | 10 | 0 | 1.85M | $5.49 | `audit59-ui.components.Timeline` |
| `ui.components.TokenPanel` | 11 | 11/11 | 6 | 8 | 3 | 11 |  14.8 |   3.8 | - | - | 11 | 0 | 1.19M | $3.71 | `audit59-ui.components.TokenPanel` |
| `ui.components.ToolbarDock` | 12 | 12/12 | 4 | 7 | 2 | 9 |  12.3 |   3.3 | - | - | 11 | 0 | 1.84M | $5.51 | patches did not apply |
| `ui.components.Tree` | 26 | 26/26 | 10 | 6 | 6 | 10 |  10.0 |   0.0 | - | - | 10 | 0 | 1.80M | $5.37 | `audit59-ui.components.Tree` |
| `ui.components.part1` | 46 | 46/46 | 6 | 6 | 4 | 8 |   8.8 |   0.8 | - | - | 10 | 0 | 2.43M | $6.93 | `audit59-ui.components.part1` |
| `ui.components.part10` | 37 | 37/37 | 8 | 8 | 4 | 12 |  15.2 |   3.2 | - | - | 14 | 0 | 2.50M | $7.11 | `audit59-ui.components.part10`, left out: merge conflict |

Totals: 142 distinct findings, 148 fix commits, 0 questions, 34.94M weighted tokens, $101.64.

## Control sweep

The control sweep off (it runs only with --sweep).
