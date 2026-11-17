# Audit round 33

Blind pairs at `d4226fab0e3e2669740411edb2a1d35dadeb46b1` (2026-11-17), run by `scripts/skulk`. Each area's directory holds its file
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
| `animator.engine` | 33 | 33/33 | 5 | 8 | 2 | 11 |  17.0 |   6.0 | - | - | 12 | 0 | 16.81M | $9.48 | `audit33-animator.engine` |
| `animator.timeline` | 12 | 12/12 | 7 | 6 | 4 | 9 |  10.2 |   1.2 | - | - | 10 | 0 | 7.11M | $4.93 | `audit33-animator.timeline` |
| `apps.chart` | 3 | 3/0 | 0 | 0 | 0 | 0 |   0.0 |   0.0 | - | - | 0 | 0 | 0.54M | $0.62 | nothing to fix |
| `apps.chart.src.part1` | 27 | 27/27 | 3 | 4 | 0 | 7 |  19.0 |  12.0 | - | - | 6 | 0 | 16.40M | $7.72 | `audit33-apps.chart.src.part1`, merged the next morning (its `docs/unruled.md` section conflicted) |
| `apps.chart.src.part2` | 27 | 27/27 | 3 | 3 | 0 | 6 |  15.0 |   9.0 | - | - | 5 | 0 | 13.76M | $6.88 | `audit33-apps.chart.src.part2` |
| `apps.chart.src.pipeline` | 10 | 10/10 | 3 | 4 | 2 | 5 |   5.7 |   0.7 | - | - | 6 | 0 | 7.94M | $4.75 | `audit33-apps.chart.src.pipeline` |
| `apps.devtools-extension` | 27 | 27/27 | 5 | 5 | 3 | 7 |   8.0 |   1.0 | - | - | 7 | 0 | 5.32M | $4.46 | `audit33-apps.devtools-extension`, merged the next morning (its `docs/unruled.md` section conflicted) |
| `apps.draw` | 14 | 14/14 | 10 | 7 | 7 | 10 |  10.0 |   0.0 | - | - | 10 | 0 | 18.75M | $8.36 | `audit33-apps.draw` |

Totals: 55 distinct findings, 56 fix commits, 0 questions, 86.63M tokens, $47.20.
