# Audit round 79

Blind pairs at `7436a32b38e97519cf2953cd719c972e72a0be83` (2026-11-23), run by skulkr. Each area's directory holds its file
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
| `apps.devtools-extension` | 28 | 28/28 | 4 | 3 | 1 | 6 |   9.0 |   3.0 |   1.0 (r33) | 7 in 13 changed | 6 | 0 | 1.23M | $3.71 | `audit79-apps.devtools-extension` |
| `apps.draw.src.part1` | 38 | 38/38 | 3 | 4 | 0 | 7 |  19.0 |  12.0 |   3.0 (r63) | 4 in 11 changed | 6 | 0 | 1.46M | $4.06 | `audit79-apps.draw.src.part1` |
| `apps.theme-editor.src` | 50 | 50/50 | 4 | 3 | 0 | 7 |  19.0 |  12.0 |  12.0 (r78) | 0 in 0 changed | 7 | 0 | 1.74M | $5.18 | `audit79-apps.theme-editor.src` |
| `audio` | 47 | 47/47 | 6 | 3 | 0 | 9 |  27.0 |  18.0 |  13.3 (r78) | 0 in 0 changed | 9 | 0 | 1.60M | $5.36 | `audit79-audio` |
| `core` | 37 | 37/37 | 4 | 1 | 1 | 4 |   4.0 |   0.0 |   3.3 (r38) | 3 in 11 changed | 5 | 0 | 0.89M | $2.79 | `audit79-core` |
| `core.core` | 28 | 28/28 | 5 | 4 | 2 | 7 |   9.0 |   2.0 |   1.1 (r40) | 4 in 3 changed | 6 | 0 | 1.32M | $3.97 | `audit79-core.core` |
| `font.outline` | 15 | 15/15 | 3 | 2 | 0 | 5 |  11.0 |   6.0 |  16.0 (r78) | 0 in 0 changed | 5 | 0 | 0.60M | $3.90 | `audit79-font.outline` |
| `forge.vite` | 50 | 50/50 | 5 | 3 | 0 | 8 |  23.0 |  15.0 |   3.0 (r78) | 0 in 0 changed | 12 | 0 | 2.43M | $7.04 | `audit79-forge.vite` |
| `gestures` | 43 | 43/43 | 3 | 4 | 1 | 6 |   9.0 |   3.0 |  10.0 (r78) | 0 in 0 changed | 5 | 0 | 1.24M | $4.06 | `audit79-gestures` |
| `icons-plugin` | 12 | 12/12 | 5 | 2 | 1 | 6 |   8.0 |   2.0 |   2.3 (r78) | 4 in 1 changed | 5 | 0 | 1.04M | $3.36 | `audit79-icons-plugin` |
| `labkit.controls` | 36 | 36/36 | 6 | 7 | 5 | 8 |   8.3 |   0.3 |   1.2 (r50) | 8 in 9 changed | 7 | 0 | 2.96M | $7.90 | `audit79-labkit.controls` |
| `labkit.trial.part1` | 27 | 27/27 | 1 | 2 | 1 | 2 |   2.0 |   0.0 |   2.7 (r51) | 2 in 9 changed | 2 | 0 | 0.97M | $2.81 | `audit79-labkit.trial.part1` |
| `loupe` | 11 | 11/11 | 8 | 3 | 1 | 10 |  17.0 |   7.0 |   3.0 (r51) | 7 in 4 changed | 9 | 0 | 0.98M | $3.04 | `audit79-loupe` |
| `renderer.part2` | 38 | 38/38 | 2 | 2 | 0 | 4 |   8.0 |   4.0 |  24.0 (r78) | 0 in 0 changed | 5 | 0 | 0.91M | $3.98 | `audit79-renderer.part2` |
| `tiles` | 5 | 5/5 | 3 | 1 | 1 | 3 |   3.0 |   0.0 |   8.0 (r78) | 0 in 0 changed | 4 | 0 | 0.63M | $2.00 | `audit79-tiles` |
| `ui.components.Timeline` | 18 | 18/18 | 2 | 4 | 1 | 5 |   6.5 |   1.5 |   6.0 (r78) | 0 in 0 changed | 4 | 0 | 0.87M | $2.63 | `audit79-ui.components.Timeline` |

Totals: 97 distinct findings, 97 fix commits, 0 questions, 20.86M weighted tokens, $65.79.

## Control sweep

The control sweep off (it runs only with --sweep).
