# Audit round 71

Blind pairs at `f51df0e1e7d5bf1efdc19be6d81db701aa19c8ac` (2026-11-22), run by skulkr. Each area's directory holds its file
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
| `apps.forge` | 23 | 23/23 | 2 | 1 | 1 | 2 |   2.0 |   0.0 |  12.0 (r70) | 0 in 0 changed | 5 | 0 | 0.93M | $2.79 | `audit71-apps.forge` |
| `apps.site.demos.part3` | 48 | 48/48 | 5 | 4 | 2 | 7 |   9.0 |   2.0 |   4.5 (r70) | 0 in 0 changed | 7 | 0 | 1.80M | $5.15 | `audit71-apps.site.demos.part3` |
| `core.canvas.SceneCanvas.part2` | 45 | 45/45 | 4 | 5 | 1 | 8 |  14.0 |   6.0 |   1.8 (r39) | 5 in 8 changed | 9 | 0 | 2.38M | $6.68 | `audit71-core.canvas.SceneCanvas.part2` |
| `core.interactions.actions.defaults` | 17 | 17/17 | 7 | 4 | 1 | 10 |  19.0 |   9.0 |   4.0 (r42) | 5 in 4 changed | 13 | 0 | 1.60M | $4.50 | `audit71-core.interactions.actions.defaults` |
| `devtools.views` | 38 | 38/38 | 1 | 4 | 0 | 5 |   9.0 |   4.0 |   6.0 (r67) | 0 in 1 changed | 5 | 0 | 1.85M | $5.29 | `audit71-devtools.views` |
| `diagram-formats` | 38 | 38/38 | 5 | 7 | 0 | 12 |  47.0 |  35.0 |  16.0 (r70) | 0 in 0 changed | 12 | 0 | 2.49M | $7.32 | `audit71-diagram-formats` |
| `diagram.containers` | 12 | 12/12 | 2 | 2 | 1 | 3 |   3.5 |   0.5 |  10.0 (r67) | 3 in 7 changed | 3 | 0 | 1.18M | $3.53 | `audit71-diagram.containers` |
| `editing.actions.edit` | 14 | 14/14 | 3 | 2 | 0 | 5 |  11.0 |   6.0 |  12.0 (r70) | 0 in 0 changed | 5 | 0 | 1.10M | $3.20 | `audit71-editing.actions.edit` |
| `forge` | 29 | 29/29 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |  12.0 (r67) | 1 in 1 changed | 4 | 0 | 1.38M | $4.12 | `audit71-forge` |
| `labkit.loupe` | 50 | 50/50 | 4 | 4 | 1 | 7 |  11.5 |   4.5 |   8.0 (r70) | 0 in 0 changed | 7 | 0 | 2.30M | $6.80 | `audit71-labkit.loupe` |
| `renderer.gpu` | 50 | 50/50 | 2 | 6 | 0 | 8 |  20.0 |  12.0 |   3.9 (r70) | 3 in 4 changed | 8 | 0 | 2.87M | $8.30 | `audit71-renderer.gpu` |
| `renderer.part1` | 38 | 38/38 | 5 | 4 | 2 | 7 |   9.0 |   2.0 |   1.6 (r54) | 6 in 17 changed | 8 | 0 | 2.33M | $6.72 | `audit71-renderer.part1` |
| `text-tools` | 32 | 32/32 | 5 | 2 | 2 | 5 |   5.0 |   0.0 |   4.0 (r58) | 6 in 4 changed | 4 | 0 | 1.29M | $3.76 | `audit71-text-tools` |
| `theme.engine` | 29 | 29/29 | 6 | 3 | 1 | 8 |  13.0 |   5.0 |  12.0 (r67) | 0 in 0 changed | 7 | 0 | 1.93M | $5.92 | `audit71-theme.engine` |
| `ui.components.Badge.effects` | 21 | 21/21 | 4 | 6 | 2 | 8 |  10.7 |   2.7 |   6.0 (r67) | 0 in 0 changed | 8 | 0 | 1.12M | $3.44 | `audit71-ui.components.Badge.effects` |
| `ui.components.part10` | 39 | 39/39 | 1 | 1 | 0 | 2 |   3.0 |   1.0 |   6.0 (r67) | 0 in 2 changed | 2 | 0 | 1.27M | $3.74 | `audit71-ui.components.part10` |

Totals: 102 distinct findings, 107 fix commits, 0 questions, 27.82M weighted tokens, $81.26.

## Control sweep

The control sweep off (it runs only with --sweep).
