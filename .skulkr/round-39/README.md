# Audit round 39

Blind pairs at `3afc6d3062dd11bd780f0bb0c8f6a478125ecb60` (2026-11-19), run by `scripts/skulk`. Each area's directory holds its file
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
| `apps.site.demos.part6` | 47 | 47/47 | 3 | 1 | 0 | 4 |   7.0 |   3.0 | - | - | 4 | 0 | 13.16M | $6.71 | `audit39-apps.site.demos.part6` |
| `core.barrel` | 15 | 15/15 | 5 | 3 | 1 | 7 |  11.0 |   4.0 | - | - | 6 | 0 | 9.88M | $5.20 | `audit39-core.barrel` |
| `core.canvas.SceneCanvas.part1` | 45 | 45/0 | 5 | 1 | 1 | 5 |   5.0 |   0.0 | - | - | 5 | 0 | 17.95M | $8.93 | `audit39-core.canvas.SceneCanvas.part1` |
| `core.canvas.SceneCanvas.part2` | 45 | 45/45 | 7 | 7 | 4 | 10 |  11.8 |   1.8 | - | - | 8 | 0 | 29.55M | $12.13 | `audit39-core.canvas.SceneCanvas.part2` |
| `core.canvas.deps` | 31 | 31/31 | 2 | 3 | 1 | 4 |   5.0 |   1.0 | - | - | 4 | 0 | 7.17M | $4.60 | `audit39-core.canvas.deps` |
| `core.canvas.nodeShapes` | 12 | 12/12 | 3 | 5 | 3 | 5 |   5.0 |   0.0 | - | - | 5 | 0 | 9.85M | $5.56 | `audit39-core.canvas.nodeShapes` |
| `core.canvas.part1` | 47 | 47/0 | 5 | 1 | 1 | 5 |   5.0 |   0.0 | - | - | 5 | 0 | 15.81M | $8.30 | `audit39-core.canvas.part1` |
| `core.canvas.part2` | 47 | 47/47 | 6 | 5 | 3 | 8 |   9.5 |   1.5 | - | - | 9 | 0 | 23.47M | $10.53 | `audit39-core.canvas.part2` |

Totals: 48 distinct findings, 46 fix commits, 0 questions, 126.84M tokens, $61.96.
