# Audit round 68

Blind pairs at `10bea68e02d106803e7a30c1d22e90799d85a3d9` (2026-11-22), run by skulkr. Each area's directory holds its file
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
| `animator.engine` | 34 | 34/34 | 7 | 5 | 3 | 9 |  11.0 |   2.0 |   6.0 (r33) | 2 in 5 changed | 11 | 0 | 3.05M | $8.46 | `audit68-animator.engine` |
| `apps.draw.src.part3` | 37 | 37/37 | 2 | 2 | 1 | 3 |   3.5 |   0.5 |   6.0 (r35) | 4 in 9 changed | 2 | 0 | 0.80M | $2.42 | `audit68-apps.draw.src.part3` |
| `core.domains` | 34 | 34/34 | 1 | 1 | 0 | 2 |   3.0 |   1.0 |   6.0 (r65) | 1 in 4 changed | 2 | 0 | 1.06M | $3.19 | `audit68-core.domains` |
| `editing.actions.insert` | 14 | 14/14 | 2 | 5 | 1 | 6 |   8.0 |   2.0 |   6.0 (r47) | 0 in 0 changed | 6 | 0 | 1.09M | $3.10 | `audit68-editing.actions.insert` |
| `geom.paths.part2` | 37 | 37/37 | 5 | 3 | 0 | 8 |  23.0 |  15.0 |   6.0 (r65) | 0 in 1 changed | 9 | 0 | 1.86M | $5.66 | `audit68-geom.paths.part2` |
| `path-tools.part1` | 37 | 37/37 | 4 | 3 | 1 | 6 |   9.0 |   3.0 |   5.8 (r53) | 0 in 1 changed | 6 | 0 | 1.68M | $4.83 | `audit68-path-tools.part1` |
| `prefs-schema` | 31 | 31/31 | 3 | 2 | 0 | 5 |  11.0 |   6.0 |   6.0 (r54) | 0 in 0 changed | 5 | 0 | 1.18M | $3.67 | `audit68-prefs-schema` |
| `prefs.edit` | 44 | 44/44 | 6 | 6 | 4 | 8 |   8.8 |   0.8 |   6.0 (r54) | 0 in 0 changed | 8 | 0 | 1.34M | $6.50 | `audit68-prefs.edit` |
| `renderer.gpu` | 47 | 47/47 | 9 | 6 | 1 | 14 |  34.0 |  20.0 |   6.0 (r54) | 7 in 9 changed | 12 | 2 | 2.93M | $8.43 | `audit68-renderer.gpu` |
| `symmetry` | 11 | 11/11 | 3 | 3 | 2 | 4 |   4.3 |   0.3 |   6.0 (r55) | 0 in 0 changed | 3 | 0 | 0.90M | $2.68 | `audit68-symmetry` |
| `tiles` | 5 | 5/5 | 5 | 7 | 3 | 9 |  11.0 |   2.0 | - | - | 9 | 0 | 0.82M | $2.45 | `audit68-tiles` |
| `ui-canvas` | 38 | 38/38 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |   6.0 (r58) | 0 in 0 changed | 5 | 0 | 1.37M | $4.06 | `audit68-ui-canvas` |
| `ui.components.Badge.shapes` | 24 | 24/24 | 2 | 3 | 1 | 4 |   5.0 |   1.0 |   6.0 (r57) | 4 in 14 changed | 3 | 0 | 0.69M | $2.21 | `audit68-ui.components.Badge.shapes` |
| `ui.components.Segmented` | 12 | 12/12 | 3 | 3 | 2 | 4 |   4.3 |   0.3 |   3.0 (r59) | 3 in 2 changed | 4 | 0 | 0.85M | $2.68 | `audit68-ui.components.Segmented` |
| `ui.components.part4` | 46 | 46/46 | 1 | 3 | 0 | 4 |   7.0 |   3.0 |   5.9 (r66) | 2 in 2 changed | 4 | 0 | 1.20M | $3.69 | `audit68-ui.components.part4` |
| `ui.components.part8` | 46 | 38/46 | 3 | 6 | 1 | 8 |  13.0 |   5.0 |   2.9 (r60) | 1 in 10 changed | 7 | 0 | 1.56M | $4.58 | `audit68-ui.components.part8` |

Totals: 99 distinct findings, 96 fix commits, 2 questions, 22.37M weighted tokens, $68.61.

## Control sweep

The control sweep off (it runs only with --sweep).
