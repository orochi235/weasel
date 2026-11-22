# Audit round 70

Blind pairs at `c0e15f5f0574e6fa86132e42a6de61cf9f5e45bc` (2026-11-22), run by skulkr. Each area's directory holds its file
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
| `apps.forge` | 22 | 22/22 | 2 | 6 | 0 | 8 |  20.0 |  12.0 |   6.0 (r70) | 0 in 0 changed | 6 | 0 | 1.00M | $3.06 | `audit70-apps.forge` |
| `apps.site.demos.part1` | 48 | 48/48 | 4 | 5 | 4 | 5 |   5.0 |   0.0 |   0.0 (r70) | 0 in 0 changed | 5 | 0 | 1.61M | $4.65 | `audit70-apps.site.demos.part1` |
| `apps.site.demos.part3` | 48 | 48/48 | 4 | 4 | 1 | 7 |  11.5 |   4.5 |   4.5 (r70) | 0 in 0 changed | 7 | 0 | 2.10M | $5.72 | `audit70-apps.site.demos.part3` |
| `core.core.scene.part1` | 40 | 40/40 | 2 | 3 | 1 | 4 |   5.0 |   1.0 |   1.0 (r70) | 0 in 0 changed | 3 | 0 | 1.25M | $3.70 | `audit70-core.core.scene.part1` |
| `core.core.scene.part3` | 40 | 40/40 | 1 | 3 | 0 | 4 |   7.0 |   3.0 |   1.0 (r70) | 0 in 0 changed | 4 | 0 | 2.08M | $6.02 | `audit70-core.core.scene.part3` |
| `diagram-formats` | 38 | 38/38 | 4 | 4 | 0 | 8 |  24.0 |  16.0 |   2.7 (r70) | 0 in 0 changed | 8 | 0 | 1.99M | $6.01 | `audit70-diagram-formats` |
| `diagram-formats.mermaid.part2` | 34 | 34/34 | 6 | 2 | 1 | 7 |   9.5 |   2.5 |   2.5 (r70) | 0 in 0 changed | 7 | 0 | 1.66M | $5.12 | `audit70-diagram-formats.mermaid.part2` |
| `editing.actions.edit` | 14 | 14/14 | 7 | 5 | 1 | 11 |  23.0 |  12.0 |  12.0 (r70) | 0 in 0 changed | 9 | 0 | 1.34M | $3.94 | `audit70-editing.actions.edit` |
| `geom.part1` | 42 | 42/42 | 4 | 3 | 1 | 6 |   9.0 |   3.0 |   3.0 (r70) | 0 in 0 changed | 7 | 0 | 1.85M | $5.60 | `audit70-geom.part1` |
| `labkit.loupe` | 50 | 50/50 | 4 | 2 | 0 | 6 |  14.0 |   8.0 |   8.0 (r70) | 0 in 0 changed | 6 | 0 | 1.96M | $5.77 | `audit70-labkit.loupe` |
| `prefs-schema` | 31 | 31/31 | 2 | 2 | 0 | 4 |   8.0 |   4.0 |   4.0 (r70) | 0 in 0 changed | 4 | 0 | 1.57M | $4.89 | `audit70-prefs-schema` |
| `react` | 31 | 31/31 | 2 | 3 | 1 | 4 |   5.0 |   1.0 |   1.0 (r70) | 0 in 0 changed | 4 | 0 | 0.91M | $2.84 | `audit70-react` |
| `renderer.gpu` | 50 | 50/50 | 5 | 3 | 1 | 7 |  11.0 |   4.0 |   4.0 (r70) | 1 in 4 changed | 8 | 0 | 2.41M | $7.47 | `audit70-renderer.gpu` |
| `ui.components.Timeline` | 18 | 18/18 | 5 | 6 | 3 | 8 |   9.5 |   1.5 |   1.5 (r70) | 0 in 0 changed | 7 | 0 | 0.53M | $3.63 | `audit70-ui.components.Timeline` |
| `ui.components.part8` | 46 | 46/46 | 3 | 1 | 0 | 4 |   7.0 |   3.0 |   9.0 (r70) | 0 in 0 changed | 6 | 0 | 1.52M | $4.56 | `audit70-ui.components.part8` |
| `ui.testing` | 15 | 15/15 | 7 | 8 | 5 | 10 |  11.0 |   1.0 |   1.0 (r70) | 0 in 0 changed | 10 | 0 | 1.10M | $3.18 | `audit70-ui.testing` |

Totals: 103 distinct findings, 101 fix commits, 0 questions, 24.88M weighted tokens, $76.16.

## Control sweep

The control sweep off (it runs only with --sweep).
