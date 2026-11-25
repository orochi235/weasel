# Audit round 50

Blind pairs at `161b7a4394b9b3a15bb07c10137fe7b18d99acba` (2026-11-20), run by `scripts/skulk`. Each area's directory holds its file
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
| `hud.menu` | 13 | 13/13 | 4 | 4 | 2 | 6 |   7.3 |   1.3 | - | - | 8 | 0 | 2.11M | $6.09 | `audit50-hud.menu` |
| `hud.widgets` | 16 | 16/16 | 5 | 6 | 3 | 8 |   9.5 |   1.5 | - | - | 8 | 0 | 2.26M | $6.45 | `audit50-hud.widgets` |
| `icons` | 15 | 15/15 | 4 | 2 | 0 | 6 |  14.0 |   8.0 | - | - | 9 | 0 | 1.33M | $4.03 | `audit50-icons` |
| `icons-plugin` | 12 | 12/12 | 4 | 6 | 2 | 8 |  10.7 |   2.7 | - | - | 10 | 0 | 2.34M | $6.72 | `audit50-icons-plugin`, left out: merge conflict |
| `kernel3d` | 41 | 41/41 | 5 | 4 | 2 | 7 |   9.0 |   2.0 | - | - | 7 | 0 | 3.86M | $10.60 | `audit50-kernel3d` |
| `labkit.annotations` | 48 | 48/48 | 7 | 9 | 4 | 12 |  15.0 |   3.0 | - | - | 14 | 0 | 3.93M | $10.92 | `audit50-labkit.annotations`, left out: merge conflict |
| `labkit.canvas` | 25 | 25/25 | 4 | 3 | 2 | 5 |   5.7 |   0.7 | - | - | 7 | 0 | 1.98M | $5.69 | `audit50-labkit.canvas`, left out: merge conflict |
| `labkit.chrome` | 22 | 22/22 | 6 | 4 | 1 | 9 |  16.5 |   7.5 | - | - | 10 | 0 | 2.75M | $7.59 | `audit50-labkit.chrome`, left out: merge conflict |
| `labkit.clock` | 15 | 15/15 | 6 | 3 | 2 | 7 |   8.3 |   1.3 | - | - | 8 | 0 | 2.08M | $5.85 | `audit50-labkit.clock`, left out: merge conflict |
| `labkit.config` | 28 | 28/28 | 9 | 4 | 2 | 11 |  15.7 |   4.7 | - | - | 12 | 0 | 3.15M | $8.70 | `audit50-labkit.config`, left out: merge conflict |
| `labkit.controls` | 36 | 36/36 | 6 | 7 | 4 | 9 |  10.2 |   1.2 | - | - | 12 | 0 | 1.55M | $7.73 | `audit50-labkit.controls`, left out: merge conflict |
| `labkit.lab.part1` | 30 | 30/30 | 5 | 4 | 2 | 7 |   9.0 |   2.0 | - | - | 11 | 0 | 3.35M | $9.15 | `audit50-labkit.lab.part1`, left out: merge conflict |
| `labkit.lab.part2` | 30 | 30/30 | 4 | 3 | 0 | 7 |  19.0 |  12.0 | - | - | 9 | 0 | 3.08M | $8.41 | `audit50-labkit.lab.part2`, left out: merge conflict |
| `labkit.loupe` | 50 | 50/50 | 6 | 3 | 1 | 8 |  13.0 |   5.0 | - | - | 10 | 0 | 3.26M | $9.28 | `audit50-labkit.loupe`, left out: merge conflict |
| `labkit.part1` | 32 | 32/32 | 5 | 6 | 3 | 8 |   9.5 |   1.5 | - | - | 10 | 1 | 2.25M | $6.43 | `audit50-labkit.part1`, left out: merge conflict |
| `labkit.part2` | 31 | 31/31 | 4 | 2 | 2 | 4 |   4.0 |   0.0 | - | - | 6 | 0 | 2.80M | $7.85 | `audit50-labkit.part2`, left out: merge conflict |

Totals: 122 distinct findings, 151 fix commits, 1 questions, 42.08M weighted tokens, $121.49.

## Control sweep

The control sweep off (it runs only with --sweep).
