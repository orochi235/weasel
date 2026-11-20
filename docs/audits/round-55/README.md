# Audit round 55

Blind pairs at `bfc55709b4b1c35343b8417dc8f74424b58d9714` (2026-11-20), run by `scripts/skulk`. Each area's directory holds its file
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
| `routing.interactions` | 13 | 13/9 | 4 | 3 | 3 | 4 |   4.0 |   0.0 | - | - | 3 | 0 | 0.77M | $2.52 | `audit55-routing.interactions` |
| `routing.interactions.actions` | 35 | 35/35 | 4 | 4 | 3 | 5 |   5.3 |   0.3 | - | - | 5 | 0 | 2.06M | $6.22 | `audit55-routing.interactions.actions` |
| `routing.interactions.dispatcher` | 44 | 44/44 | 8 | 5 | 4 | 9 |   9.8 |   0.8 | - | - | 10 | 0 | 3.62M | $10.35 | `audit55-routing.interactions.dispatcher` |
| `routing.keymaps` | 10 | 10/10 | 4 | 5 | 2 | 7 |   9.0 |   2.0 | - | - | 6 | 0 | 1.34M | $4.01 | `audit55-routing.keymaps` |
| `routing.tools` | 25 | 25/25 | 4 | 5 | 4 | 5 |   5.0 |   0.0 | - | - | 5 | 0 | 1.56M | $4.78 | `audit55-routing.tools` |
| `scale` | 12 | 12/12 | 9 | 6 | 4 | 11 |  13.0 |   2.0 | - | - | 10 | 0 | 1.37M | $4.25 | `audit55-scale` |
| `select` | 6 | 6/6 | 4 | 2 | 1 | 5 |   6.5 |   1.5 | - | - | 4 | 0 | 0.53M | $1.62 | `audit55-select` |
| `simulation` | 8 | 8/8 | 3 | 1 | 1 | 3 |   3.0 |   0.0 | - | - | 2 | 0 | 0.64M | $1.99 | `audit55-simulation` |
| `storage` | 17 | 17/17 | 3 | 8 | 2 | 9 |  11.0 |   2.0 | - | - | 8 | 0 | 1.35M | $4.21 | `audit55-storage` |
| `stroke` | 31 | 31/31 | 4 | 5 | 2 | 7 |   9.0 |   2.0 | - | - | 7 | 0 | 2.68M | $7.95 | `audit55-stroke` |
| `svg.part1` | 45 | 45/45 | 9 | 6 | 2 | 13 |  22.3 |   9.3 | - | - | 12 | 0 | 4.80M | $13.08 | `audit55-svg.part1` |
| `svg.part2` | 44 | 44/44 | 9 | 8 | 3 | 14 |  21.5 |   7.5 | - | - | 12 | 0 | 4.20M | $11.75 | `audit55-svg.part2` |
| `symmetry` | 11 | 11/11 | 7 | 3 | 1 | 9 |  15.0 |   6.0 | - | - | 10 | 0 | 1.78M | $5.36 | `audit55-symmetry` |
| `text` | 35 | 35/35 | 6 | 7 | 2 | 11 |  17.7 |   6.7 | - | - | 11 | 0 | 3.41M | $9.65 | `audit55-text` |
| `text-dom` | 35 | 35/35 | 5 | 6 | 2 | 9 |  13.0 |   4.0 | - | - | 9 | 0 | 2.04M | $6.22 | `audit55-text-dom` |
| `text-shaping` | 5 | 5/5 | 3 | 6 | 3 | 6 |   6.0 |   0.0 | - | - | 6 | 0 | 1.24M | $3.74 | `audit55-text-shaping` |

Totals: 127 distinct findings, 120 fix commits, 0 questions, 33.40M weighted tokens, $97.70.

## Control sweep

The control sweep off (it runs only with --sweep).
