# Audit round 69

Blind pairs at `85d050b8517caf8fb72762e33ef3d59cbec89c53` (2026-11-22), run by skulkr. Each area's directory holds its file
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
| `apps.chart.src.part2` | 27 | 27/27 | 2 | 3 | 1 | 4 |   5.0 |   1.0 |   6.0 (r63) | 0 in 0 changed | 5 | 0 | 0.86M | $2.57 | `audit69-apps.chart.src.part2` |
| `apps.site` | 46 | 45/46 | 2 | 3 | 1 | 4 |   5.0 |   1.0 |   4.5 (r40) | 3 in 9 changed | 5 | 0 | 1.68M | $5.74 | `audit69-apps.site` |
| `apps.site.demos.part5` | 48 | 36/48 | 2 | 2 | 1 | 3 |   3.5 |   0.5 |   4.7 (r66) | 3 in 3 changed | 3 | 0 | 1.27M | $3.71 | `audit69-apps.site.demos.part5` |
| `core.core.scene.part3` | 40 | 40/40 | 2 | 4 | 0 | 6 |  14.0 |   8.0 |   4.5 (r41) | 5 in 16 changed | 6 | 0 | 1.65M | $4.89 | `audit69-core.core.scene.part3` |
| `editing` | 42 | 42/42 | 2 | 3 | 1 | 4 |   5.0 |   1.0 |   2.3 (r47) | 2 in 5 changed | 4 | 0 | 1.92M | $5.41 | `audit69-editing` |
| `geom.part1` | 42 | 42/42 | 2 | 3 | 0 | 5 |  11.0 |   6.0 |   4.5 (r49) | 2 in 10 changed | 5 | 0 | 1.52M | $4.65 | `audit69-geom.part1` |
| `geom.paths.part2` | 37 | 37/37 | 3 | 1 | 0 | 4 |   7.0 |   3.0 |  15.0 (r68) | 0 in 0 changed | 5 | 0 | 1.71M | $5.25 | `audit69-geom.paths.part2` |
| `geom.warp` | 18 | 18/18 | 4 | 5 | 2 | 7 |   9.0 |   2.0 |   4.5 (r49) | 7 in 6 changed | 8 | 0 | 1.40M | $4.48 | `audit69-geom.warp` |
| `labkit.config` | 28 | 28/28 | 4 | 7 | 2 | 9 |  12.3 |   3.3 |   4.7 (r50) | 8 in 13 changed | 9 | 0 | 1.80M | $5.39 | `audit69-labkit.config` |
| `labkit.loupe` | 50 | 50/50 | 7 | 3 | 0 | 10 |  31.0 |  21.0 |   5.0 (r50) | 7 in 12 changed | 8 | 0 | 2.40M | $7.14 | `audit69-labkit.loupe` |
| `p-touch` | 10 | 10/10 | 2 | 2 | 0 | 4 |   8.0 |   4.0 |   4.5 (r64) | 4 in 5 changed | 3 | 0 | 0.88M | $2.55 | `audit69-p-touch` |
| `prefs-schema` | 31 | 31/31 | 2 | 3 | 0 | 5 |  11.0 |   6.0 |   6.0 (r68) | 0 in 0 changed | 5 | 0 | 1.61M | $5.09 | `audit69-prefs-schema` |
| `renderer.gpu` | 49 | 49/49 | 3 | 5 | 0 | 8 |  23.0 |  15.0 |  20.0 (r68) | 0 in 0 changed | 7 | 0 | 2.68M | $8.28 | `audit69-renderer.gpu` |
| `ui.components.Along` | 47 | 47/47 | 4 | 2 | 1 | 5 |   6.5 |   1.5 |   5.0 (r60) | 4 in 3 changed | 6 | 0 | 1.57M | $4.73 | `audit69-ui.components.Along` |
| `ui.components.part5` | 46 | 46/38 | 1 | 1 | 0 | 2 |   3.0 |   1.0 |   2.1 (r60) | 2 in 12 changed | 2 | 0 | 1.08M | $3.23 | `audit69-ui.components.part5` |
| `ui.components.part6` | 46 | 46/46 | 2 | 3 | 1 | 4 |   5.0 |   1.0 |   2.5 (r60) | 2 in 3 changed | 6 | 0 | 1.51M | $4.40 | `audit69-ui.components.part6` |

Totals: 84 distinct findings, 87 fix commits, 0 questions, 25.54M weighted tokens, $77.51.

## Control sweep

The control sweep off (it runs only with --sweep).
