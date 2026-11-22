# Audit round 72

Blind pairs at `f6ce272099f3a03ade5d48ba8b6efd3dada64e06` (2026-11-22), run by skulkr. Each area's directory holds its file
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
| `animator.engine` | 34 | 34/34 | 2 | 3 | 1 | 4 |   5.0 |   1.0 |   2.0 (r68) | 0 in 0 changed | 4 | 0 | 1.67M | $5.09 | `audit72-animator.engine` |
| `core.barrel` | 15 | 15/15 | 0 | 2 | 0 | 2 |   2.0 |   0.0 |   4.0 (r39) | 1 in 10 changed | 2 | 0 | 0.85M | $2.54 | `audit72-core.barrel` |
| `core.canvas.SceneCanvas.part2` | 45 | 45/45 | 2 | 2 | 1 | 3 |   3.5 |   0.5 |   6.0 (r71) | 0 in 0 changed | 3 | 0 | 1.54M | $4.45 | `audit72-core.canvas.SceneCanvas.part2` |
| `core.interactions.actions.defaults` | 17 | 17/17 | 3 | 4 | 1 | 6 |   9.0 |   3.0 |   9.0 (r71) | 0 in 0 changed | 4 | 0 | 1.59M | $4.39 | `audit72-core.interactions.actions.defaults` |
| `core.interactions.gestures` | 16 | 16/16 | 6 | 6 | 4 | 8 |   8.8 |   0.8 |   4.0 (r42) | 9 in 5 changed | 7 | 0 | 0.93M | $2.80 | `audit72-core.interactions.gestures` |
| `diagram-formats` | 38 | 38/38 | 5 | 4 | 2 | 7 |   9.0 |   2.0 |  35.0 (r71) | 0 in 1 changed | 7 | 0 | 1.65M | $5.22 | `audit72-diagram-formats` |
| `diagram-formats.mermaid.part1` | 35 | 35/35 | 12 | 12 | 3 | 21 |  41.3 |  20.3 |   1.8 (r46) | 2 in 3 changed | 24 | 0 | 3.37M | $9.69 | `audit72-diagram-formats.mermaid.part1` |
| `diagram.effect.part1` | 31 | 31/31 | 6 | 8 | 1 | 13 |  30.5 |  17.5 |   1.8 (r46) | 3 in 2 changed | 12 | 0 | 1.89M | $5.04 | `audit72-diagram.effect.part1` |
| `diagram.outlines` | 11 | 11/11 | 5 | 5 | 2 | 8 |  11.0 |   3.0 |   4.0 (r46) | 4 in 2 changed | 8 | 0 | 1.07M | $3.09 | `audit72-diagram.outlines` |
| `editing.actions.edit` | 14 | 14/14 | 1 | 2 | 0 | 3 |   5.0 |   2.0 |   6.0 (r71) | 0 in 0 changed | 3 | 0 | 0.57M | $3.08 | `audit72-editing.actions.edit` |
| `paint` | 32 | 32/32 | 6 | 8 | 4 | 10 |  11.6 |   1.6 |   4.0 (r53) | 1 in 4 changed | 10 | 1 | 1.76M | $5.15 | `audit72-paint` |
| `path-tools.pathEdit` | 18 | 18/18 | 5 | 4 | 3 | 6 |   6.5 |   0.5 |   2.0 (r53) | 0 in 1 changed | 10 | 0 | 1.75M | $4.87 | `audit72-path-tools.pathEdit` |
| `renderer.gpu.webgpu` | 37 | 37/37 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |   8.9 (r71) | 0 in 2 changed | 4 | 0 | 1.70M | $5.41 | `audit72-renderer.gpu.webgpu` |
| `scale` | 12 | 12/12 | 4 | 3 | 1 | 6 |   9.0 |   3.0 |   2.0 (r55) | 0 in 0 changed | 7 | 0 | 1.11M | $3.33 | `audit72-scale` |
| `theme.engine` | 29 | 29/29 | 2 | 4 | 0 | 6 |  14.0 |   8.0 |   5.0 (r71) | 0 in 0 changed | 6 | 0 | 1.91M | $5.69 | `audit72-theme.engine` |
| `tiles` | 5 | 5/5 | 3 | 5 | 1 | 7 |  11.0 |   4.0 |   2.0 (r68) | 0 in 0 changed | 7 | 0 | 0.92M | $2.78 | `audit72-tiles` |

Totals: 115 distinct findings, 118 fix commits, 1 questions, 24.30M weighted tokens, $72.62.

## Control sweep

The control sweep off (it runs only with --sweep).
