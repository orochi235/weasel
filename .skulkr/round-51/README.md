# Audit round 51

Blind pairs at `d6aa8f2ede77fc3556ffbf594c570943b8bf31f2` (2026-11-20), run by `scripts/skulk`. Each area's directory holds its file
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
| `labkit.primitives` | 10 | 10/10 | 2 | 4 | 2 | 4 |   4.0 |   0.0 | - | - | 4 | 0 | 0.66M | $3.11 | `audit51-labkit.primitives` |
| `labkit.specimen` | 18 | 18/18 | 3 | 5 | 2 | 6 |   7.0 |   1.0 | - | - | 8 | 0 | 2.15M | $5.98 | `audit51-labkit.specimen` |
| `labkit.state` | 29 | 29/29 | 5 | 8 | 4 | 9 |   9.8 |   0.8 | - | - | 9 | 0 | 2.32M | $6.67 | `audit51-labkit.state` |
| `labkit.surface` | 11 | 11/11 | 8 | 5 | 1 | 12 |  26.0 |  14.0 | - | - | 12 | 0 | 2.25M | $6.68 | `audit51-labkit.surface` |
| `labkit.trial.part1` | 27 | 27/27 | 4 | 6 | 2 | 8 |  10.7 |   2.7 | - | - | 9 | 1 | 4.03M | $10.66 | `audit51-labkit.trial.part1` |
| `labkit.trial.part2` | 26 | 26/26 | 5 | 6 | 1 | 10 |  20.0 |  10.0 | - | - | 8 | 0 | 1.50M | $8.17 | `audit51-labkit.trial.part2`, left out: merge conflict |
| `loupe` | 9 | 9/9 | 5 | 5 | 2 | 8 |  11.0 |   3.0 | - | - | 8 | 0 | 1.62M | $4.65 | `audit51-loupe` |
| `measure` | 21 | 21/21 | 4 | 2 | 1 | 5 |   6.5 |   1.5 | - | - | 5 | 1 | 1.94M | $5.48 | `audit51-measure` |

Totals: 62 distinct findings, 63 fix commits, 2 questions, 16.46M weighted tokens, $51.40.

## Control sweep

The control sweep off (it runs only with --sweep).
