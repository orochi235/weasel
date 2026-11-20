# Audit round 40

Blind pairs at `603a953acedbe17c16d34cffc6ad28dc47c06809` (2026-11-19), run by `scripts/skulk`. Each area's directory holds its file
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
| `apps.chart` | 3 | 3/3 | 0 | 1 | 0 | 1 |   1.0 |   0.0 | - | - | 1 | 0 | 1.91M | $1.76 | `audit40-apps.chart` |
| `apps.site` | 44 | 44/40 | 4 | 4 | 1 | 7 |  11.5 |   4.5 | - | - | 7 | 0 | 18.92M | $8.64 | `audit40-apps.site` |
| `apps.theme-editor.src` | 50 | 47/48 | 5 | 6 | 2 | 9 |  13.0 |   4.0 | - | - | 8 | 0 | 21.06M | $10.22 | `audit40-apps.theme-editor.src` |
| `core.canvas.SceneCanvas.part1` | 45 | 45/45 | 5 | 5 | 2 | 8 |  11.0 |   3.0 | - | - | 9 | 0 | 27.28M | $11.83 | `audit40-core.canvas.SceneCanvas.part1` |
| `core.canvas.part1` | 47 | 47/47 | 3 | 3 | 0 | 6 |  15.0 |   9.0 | - | - | 6 | 0 | 21.93M | $10.26 | `audit40-core.canvas.part1`, left out: merge conflict |
| `core.canvas.part3` | 46 | 46/46 | 3 | 3 | 2 | 4 |   4.3 |   0.3 | - | - | 4 | 0 | 12.89M | $7.00 | `audit40-core.canvas.part3` |
| `core.canvas.renderWorker` | 21 | 21/21 | 7 | 5 | 4 | 8 |   8.6 |   0.6 | - | - | 10 | 0 | 16.58M | $8.47 | `audit40-core.canvas.renderWorker` |
| `core.core` | 35 | 35/35 | 6 | 5 | 3 | 8 |   9.5 |   1.5 | - | - | 11 | 0 | 12.25M | $6.80 | `audit40-core.core` |

Totals: 51 distinct findings, 56 fix commits, 0 questions, 132.81M tokens, $64.98.

## Control sweep

`scripts/control-sweep.mjs` at the same commit operated 2503 controls in 180 demos in 29.4 min: 0 dead, 19 unsure, 1086 skipped, 8 waived, 0 errors; 0 demos did not load. The dead controls went to one fixer; its report and the run's summary are in `control-sweep/`.
