# Audit round 58

Blind pairs at `b400d7039e8ac2f03166b3332ac613eba61c689f` (2026-11-20), run by `scripts/skulk`. Each area's directory holds its file
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
| `text-tools` | 31 | 31/31 | 4 | 8 | 2 | 10 |  14.0 |   4.0 | - | - | 15 | 0 | 3.79M | $10.39 | `audit58-text-tools` |
| `text.layout` | 30 | 30/30 | 3 | 3 | 1 | 5 |   7.0 |   2.0 | - | - | 4 | 0 | 3.33M | $9.83 | `audit58-text.layout` |
| `theme.part1` | 28 | 26/25 | 7 | 10 | 6 | 11 |  11.6 |   0.6 | - | - | 11 | 0 | 2.11M | $6.25 | `audit58-theme.part1` |
| `theme.part2` | 27 | 27/27 | 1 | 2 | 0 | 3 |   5.0 |   2.0 | - | - | 3 | 0 | 1.40M | $4.32 | `audit58-theme.part2` |
| `ui-canvas` | 38 | 38/38 | 4 | 5 | 1 | 8 |  14.0 |   6.0 | - | - | 7 | 2 | 2.64M | $7.46 | `audit58-ui-canvas` |
| `ui-input` | 23 | 23/23 | 4 | 3 | 2 | 5 |   5.7 |   0.7 | - | - | 5 | 0 | 1.65M | $5.02 | `audit58-ui-input` |
| `ui-logic` | 9 | 9/9 | 5 | 4 | 2 | 7 |   9.0 |   2.0 | - | - | 7 | 0 | 1.26M | $3.73 | `audit58-ui-logic` |
| `ui.components.Badge` | 21 | 0/21 | 7 | 8 | 5 | 10 |     - |     - | - | - | 10 | 0 | 1.57M | $4.77 | `audit58-ui.components.Badge`; reviewer A never ran or never finished its report, so no estimate |
| `ui.components.CurveEditor` | 33 | 33/33 | 10 | 11 | 4 | 17 |  25.4 |   8.4 | - | - | 14 | 0 | 2.51M | $7.38 | `audit58-ui.components.CurveEditor` |
| `ui.components.Field` | 10 | 10/10 | 2 | 4 | 1 | 5 |   6.5 |   1.5 | - | - | 5 | 0 | 0.65M | $3.55 | `audit58-ui.components.Field` |
| `ui.components.GradientEditor` | 13 | 13/13 | 7 | 6 | 3 | 10 |  13.0 |   3.0 | - | - | 10 | 0 | 1.88M | $5.59 | `audit58-ui.components.GradientEditor` |
| `ui.components.Keycaps` | 27 | 27/27 | 9 | 12 | 7 | 14 |  15.3 |   1.3 | - | - | 13 | 0 | 1.61M | $4.89 | `audit58-ui.components.Keycaps` |
| `ui.components.LayerList` | 11 | 11/11 | 4 | 5 | 2 | 7 |   9.0 |   2.0 | - | - | 6 | 0 | 1.07M | $3.30 | `audit58-ui.components.LayerList` |
| `ui.components.Menu` | 16 | 16/16 | 5 | 5 | 1 | 9 |  17.0 |   8.0 | - | - | 10 | 0 | 1.88M | $5.48 | `audit58-ui.components.Menu` |
| `ui.components.MenuBar` | 10 | 10/10 | 4 | 2 | 2 | 4 |   4.0 |   0.0 | - | - | 4 | 0 | 0.96M | $2.98 | `audit58-ui.components.MenuBar` |
| `ui.components.MotifFrame` | 26 | 26/26 | 8 | 6 | 3 | 11 |  14.8 |   3.8 | - | - | 11 | 0 | 1.69M | $4.99 | `audit58-ui.components.MotifFrame` |

Totals: 136 distinct findings, 135 fix commits, 2 questions, 30.01M weighted tokens, $89.93.

## Control sweep

The control sweep off (it runs only with --sweep).
