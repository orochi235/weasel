# Audit round 82

Blind pairs at `49821d7197a006c0f9dfec5748c468c2f0ccaca6` (2026-11-24), run by skulkr. Each area's directory holds its file
list (`files.txt`), both reviewers' findings (`A.md`, `B.md`), the matching (`match.json`), the fixer's
report (`fix.md`) and the numbers below (`area.json`). The method is `docs/hardening.md`, "Blind pairs".

"Read" is how many listed files each reviewer says it read. "Est." is Chapman's estimate of what the area held,
"left" that less the distinct findings, and "last left" the previous pass's figure, which this pass tests.
"New code" counts findings citing a file changed since that pass. "Commits" is what the fixer committed.
"Weighted tokens" counts each kind of token at its price against an input token (`TOKEN_WEIGHTS` in skulkr's `src/usage.mjs`); "cost" is list price.
One record per job is in `usage.jsonl`. The shas in `fix.md` are the fixer's, on its node; the same commits
as applied here are `fixCommits` in `area.json`.

| Area | Files | Read A/B | A | B | Shared | Distinct | Est. | Left | Last left | New code | Commits | Questions | Weighted tokens | Cost | Per file | Branch |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| `core.canvas.SceneCanvas.part1` | 45 | 45/45 | 2 | 3 | 2 | 3 |   3.0 |   0.0 |   0.0 (r82) | 0 in 0 changed | 3 | 0 | 1.34M | $4.08 | $0.091 | `audit82-core.canvas.SceneCanvas.part1` |
| `forge.vite.part1` | 27 | 27/27 | 7 | 3 | 0 | 10 |  31.0 |  21.0 |  21.0 (r82) | 0 in 0 changed | 11 | 0 | 1.67M | $5.02 | $0.186 | `audit82-forge.vite.part1` |
| `geom.booleans` | 32 | 32/32 | 3 | 6 | 1 | 8 |  13.0 |   5.0 |   5.0 (r82) | 0 in 0 changed | 9 | 0 | 1.71M | $5.20 | $0.163 | `audit82-geom.booleans` |
| `geom.part1` | 42 | 42/42 | 3 | 2 | 0 | 5 |  11.0 |   6.0 |   6.0 (r82) | 0 in 0 changed | 5 | 0 | 1.47M | $4.54 | $0.108 | `audit82-geom.part1` |
| `labkit.loupe.lens` | 33 | 33/33 | 6 | 4 | 0 | 10 |  34.0 |  24.0 |  24.0 (r82) | 0 in 0 changed | 12 | 0 | 2.44M | $6.75 | $0.205 | `audit82-labkit.loupe.lens` |
| `renderer.testing` | 12 | 12/12 | 5 | 2 | 1 | 6 |   8.0 |   2.0 |   2.0 (r82) | 0 in 0 changed | 5 | 0 | 1.07M | $3.28 | $0.273 | `audit82-renderer.testing` |
| `ui.components.Keycaps` | 28 | 28/28 | 4 | 3 | 1 | 6 |   9.0 |   3.0 |   3.0 (r82) | 0 in 0 changed | 6 | 0 | 1.15M | $3.63 | $0.130 | `audit82-ui.components.Keycaps` |
| `ui.components.part8` | 46 | 46/46 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |   2.0 (r82) | 0 in 0 changed | 4 | 0 | 1.42M | $4.22 | $0.092 | `audit82-ui.components.part8` |

Totals: 53 distinct findings, 55 fix commits, 0 questions, 12.27M weighted tokens, $36.72 ($4.59 per area, $0.139 per file).

## Control sweep

The control sweep off (it runs only with --sweep).
