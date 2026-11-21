# Audit round 65

Blind pairs at `70a055a4a838241c80da57b5aa579326d8d95bed` (2026-11-21), run by skulkr. Each area's directory holds its file
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
| `animator` | 34 | 34/34 | 6 | 4 | 2 | 8 |  10.7 |   2.7 |   4.0 (r32) | 4 in 17 changed | 8 | 0 | 2.47M | $7.29 | `audit65-animator` |
| `apps.chart.src.part1` | 27 | 27/27 | 2 | 3 | 1 | 4 |   5.0 |   1.0 |  12.0 (r33) | 5 in 9 changed | 5 | 0 | 1.87M | $5.44 | `audit65-apps.chart.src.part1` |
| `apps.site.demos.platformer` | 20 | 20/20 | 4 | 5 | 2 | 7 |   9.0 |   2.0 |   4.0 (r36) | 0 in 0 changed | 7 | 0 | 0.84M | $4.44 | `audit65-apps.site.demos.platformer` |
| `core.domains` | 34 | 34/34 | 2 | 3 | 0 | 5 |  11.0 |   6.0 |  24.0 (r42) | 0 in 1 changed | 4 | 0 | 2.27M | $6.54 | `audit65-core.domains`, left out: merge conflict |
| `diagram-formats` | 36 | 36/36 | 6 | 6 | 2 | 10 |  15.3 |   5.3 |   4.0 (r46) | 0 in 1 changed | 10 | 0 | 3.35M | $9.48 | `audit65-diagram-formats` |
| `diagram-formats.drawXml` | 14 | 14/14 | 3 | 5 | 0 | 8 |  23.0 |  15.0 |   5.0 (r63) | 8 in 9 changed | 8 | 0 | 1.90M | $5.74 | `audit65-diagram-formats.drawXml` |
| `forge` | 29 | 29/29 | 2 | 5 | 0 | 7 |  17.0 |  10.0 |  12.0 (r47) | 4 in 8 changed | 9 | 1 | 1.61M | $9.62 | `audit65-forge` |
| `geom.paths.part2` | 37 | 37/37 | 2 | 3 | 0 | 5 |  11.0 |   6.0 |   4.0 (r49) | 0 in 1 changed | 5 | 0 | 2.55M | $7.59 | `audit65-geom.paths.part2` |
| `labkit.lab.part2` | 30 | 30/30 | 4 | 3 | 1 | 6 |   9.0 |   3.0 |  15.0 (r63) | 0 in 0 changed | 5 | 0 | 2.75M | $7.67 | `audit65-labkit.lab.part2` |
| `prefs` | 37 | 37/37 | 7 | 2 | 1 | 8 |  11.0 |   3.0 |   3.8 (r53) | 0 in 1 changed | 8 | 0 | 2.28M | $6.85 | `audit65-prefs` |
| `renderer.testing` | 12 | 12/12 | 3 | 4 | 1 | 6 |   9.0 |   3.0 |   3.8 (r54) | 1 in 2 changed | 5 | 0 | 1.27M | $5.53 | `audit65-renderer.testing` |
| `svg.part2` | 44 | 44/44 | 7 | 5 | 1 | 11 |  23.0 |  12.0 |  13.3 (r63) | 7 in 12 changed | 11 | 0 | 4.01M | $11.40 | `audit65-svg.part2`, left out: merge conflict |
| `ui.components.Badge.effects` | 20 | 20/20 | 7 | 6 | 2 | 11 |  17.7 |   6.7 |  40.0 (r56) | 9 in 14 changed | 10 | 0 | 1.75M | $5.21 | `audit65-ui.components.Badge.effects`, left out: merge conflict |
| `ui.components.CurveEditor` | 33 | 33/33 | 8 | 8 | 4 | 12 |  15.2 |   3.2 |   8.4 (r58) | 0 in 0 changed | 14 | 0 | 2.67M | $7.90 | `audit65-ui.components.CurveEditor`, left out: merge conflict |
| `ui.components.MotifFrame` | 26 | 26/26 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |   3.8 (r58) | 0 in 0 changed | 5 | 0 | 1.22M | $3.72 | `audit65-ui.components.MotifFrame`, left out: merge conflict |
| `ui.components.TokenPanel` | 11 | 11/11 | 5 | 6 | 1 | 10 |  20.0 |  10.0 |   3.8 (r59) | 0 in 0 changed | 10 | 0 | 1.83M | $5.40 | `audit65-ui.components.TokenPanel` |

Totals: 123 distinct findings, 124 fix commits, 1 questions, 34.65M weighted tokens, $109.82.

## Control sweep

The control sweep off (it runs only with --sweep).
