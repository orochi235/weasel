# Audit round 41

Blind pairs at `782733b19c54308edbc779a6bdfcae2ca398cf65` (2026-11-19), run by `scripts/skulk`. Each area's directory holds its file
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
| `core.core.geometry` | 12 | 12/12 | 5 | 4 | 2 | 7 |   9.0 |   2.0 | - | - | 8 | 0 | 7.81M | $4.67 | `audit41-core.core.geometry` |
| `core.core.ops` | 24 | 24/24 | 5 | 2 | 2 | 5 |   5.0 |   0.0 | - | - | 6 | 0 | 4.96M | $3.60 | `audit41-core.core.ops` |
| `core.core.pages` | 11 | 11/11 | 3 | 4 | 3 | 4 |   4.0 |   0.0 | - | - | 4 | 0 | 7.63M | $4.89 | `audit41-core.core.pages` |
| `core.core.scene.part1` | 39 | 39/39 | 6 | 5 | 2 | 9 |  13.0 |   4.0 | - | - | 9 | 0 | 22.41M | $10.21 | `audit41-core.core.scene.part1` |
| `core.core.scene.part2` | 39 | 39/39 | 7 | 4 | 2 | 9 |  12.3 |   3.3 | - | - | 9 | 0 | 10.68M | $6.56 | `audit41-core.core.scene.part2` |
| `core.core.scene.part3` | 38 | 38/38 | 4 | 4 | 1 | 7 |  11.5 |   4.5 | - | - | 8 | 0 | 20.33M | $9.51 | `audit41-core.core.scene.part3`, left out: merge conflict |
| `core.core.viewport` | 22 | 22/22 | 5 | 6 | 2 | 9 |  13.0 |   4.0 | - | - | 9 | 0 | 11.40M | $6.08 | `audit41-core.core.viewport` |
| `core.debug` | 12 | 12/12 | 2 | 4 | 0 | 6 |  14.0 |   8.0 | - | - | 6 | 0 | 11.08M | $5.60 | `audit41-core.debug` |

Totals: 56 distinct findings, 59 fix commits, 0 questions, 96.31M tokens, $51.12.

## Control sweep

The control sweep did not run: no record came back; see /Users/mike/.local/state/weasel-skulk/nights/2026-11-20T01-31-25-262Z-round41/control-sweep/onto.log.
