# Audit round 54

Blind pairs at `608f35f5258a05f095a34c54f949616c26b75022` (2026-11-20), run by `scripts/skulk`. Each area's directory holds its file
list (`files.txt`), both reviewers' findings (`A.md`, `B.md`), the matching (`match.json`), the fixer's
report (`fix.md`) and the numbers below (`area.json`). The method is `docs/hardening.md`, "Blind pairs".

"Read" is how many listed files each reviewer says it read. "Est." is Chapman's estimate of what the area held,
"left" that less the distinct findings, and "last left" the previous pass's figure, which this pass tests.
"New code" counts findings citing a file changed since that pass. "Commits" is what the fixer committed.
"Weighted tokens" counts each kind of token at its price against an input token (`TOKEN_WEIGHTS` in `scripts/skulk/usage.mjs`); "cost" is list price.
One record per job is in `usage.jsonl`. The shas in `fix.md` are the fixer's, on its node; the same commits
as applied here are `fixCommits` in `area.json`.

| Area | Files | Read A/B | A | B | Shared | Distinct | Est. | Left | Last left | New code | Commits | Questions | Weighted tokens | Cost | Branch |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| `prefs-editor.PrefSchemaEditor.part1` | 36 | 36/28 | 2 | 2 | 1 | 3 |   3.5 |   0.5 | - | - | 3 | 0 | 1.87M | $5.65 | `audit54-prefs-editor.PrefSchemaEditor.part1` |
| `prefs-editor.PrefSchemaEditor.part2` | 36 | 36/36 | 4 | 3 | 2 | 5 |   5.7 |   0.7 | - | - | 5 | 0 | 1.84M | $5.52 | `audit54-prefs-editor.PrefSchemaEditor.part2` |
| `prefs-schema` | 31 | 31/31 | 5 | 4 | 1 | 8 |  14.0 |   6.0 | - | - | 8 | 0 | 2.46M | $7.27 | `audit54-prefs-schema` |
| `prefs.edit` | 44 | 44/44 | 8 | 5 | 2 | 11 |  17.0 |   6.0 | - | - | 12 | 0 | 3.08M | $9.07 | `audit54-prefs.edit` |
| `quantity` | 23 | 23/23 | 6 | 8 | 2 | 12 |  20.0 |   8.0 | - | - | 13 | 0 | 2.75M | $8.30 | `audit54-quantity` |
| `react` | 31 | 31/31 | 6 | 6 | 3 | 9 |  11.3 |   2.3 | - | - | 8 | 0 | 1.76M | $5.32 | `audit54-react` |
| `registry` | 24 | 24/24 | 2 | 8 | 2 | 8 |   8.0 |   0.0 | - | - | 8 | 0 | 0.53M | $3.35 | `audit54-registry` |
| `renderer.cache` | 11 | 11/11 | 1 | 1 | 1 | 1 |   1.0 |   0.0 | - | - | 1 | 0 | 1.35M | $4.06 | `audit54-renderer.cache` |
| `renderer.draw` | 35 | 35/35 | 3 | 3 | 0 | 6 |  15.0 |   9.0 | - | - | 6 | 0 | 3.92M | $11.05 | `audit54-renderer.draw` |
| `renderer.gpu` | 47 | 47/47 | 5 | 8 | 2 | 11 |  17.0 |   6.0 | - | - | 11 | 2 | 2.88M | $8.65 | `audit54-renderer.gpu` |
| `renderer.part1` | 37 | 37/37 | 6 | 8 | 4 | 10 |  11.6 |   1.6 | - | - | 10 | 0 | 4.02M | $11.15 | `audit54-renderer.part1`, left out: merge conflict |
| `renderer.part2` | 36 | 36/36 | 8 | 4 | 3 | 9 |  10.3 |   1.3 | - | - | 9 | 0 | 3.81M | $10.52 | `audit54-renderer.part2` |
| `renderer.shaders` | 18 | 18/18 | 4 | 4 | 2 | 6 |   7.3 |   1.3 | - | - | 6 | 0 | 2.17M | $6.48 | `audit54-renderer.shaders` |
| `renderer.testing` | 10 | 10/10 | 8 | 6 | 3 | 11 |  14.8 |   3.8 | - | - | 11 | 0 | 2.24M | $6.39 | `audit54-renderer.testing` |
| `rig` | 16 | 16/16 | 2 | 3 | 2 | 3 |   3.0 |   0.0 | - | - | 3 | 0 | 1.14M | $3.54 | `audit54-rig` |
| `routing` | 34 | 34/34 | 5 | 5 | 3 | 7 |   8.0 |   1.0 | - | - | 7 | 0 | 2.21M | $6.55 | `audit54-routing` |

Totals: 120 distinct findings, 121 fix commits, 2 questions, 38.02M weighted tokens, $112.87.

## Control sweep

The control sweep off (it runs only with --sweep).
