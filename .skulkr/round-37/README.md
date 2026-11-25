# Audit round 37

Blind pairs at `c612cad371d9093df82913a3e49045e0f89422ea` (2026-11-18), run by `scripts/skulk`. Each area's directory holds its file
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
| `audio` | 46 | 45/45 | 7 | 9 | 4 | 12 |  15.0 |   3.0 | - | - | 10 | 0 | 7.56M | $10.03 | `audit37-audio` |
| `audio.graph` | 13 | 13/13 | 3 | 4 | 2 | 5 |   5.7 |   0.7 | - | - | 5 | 0 | 6.75M | $4.90 | `audit37-audio.graph` |
| `audio.testing` | 13 | 13/13 | 8 | 12 | 5 | 15 |  18.5 |   3.5 | - | - | 16 | 0 | 7.46M | $4.53 | `audit37-audio.testing` |
| `bidi` | 11 | 11/11 | 2 | 1 | 0 | 3 |   5.0 |   2.0 | - | - | 3 | 0 | 3.64M | $3.66 | `audit37-bidi` |
| `brush` | 2 | 2/2 | 1 | 2 | 0 | 3 |   5.0 |   2.0 | - | - | 3 | 0 | 5.19M | $3.07 | `audit37-brush` |
| `clock` | 13 | 13/13 | 6 | 6 | 4 | 8 |   8.8 |   0.8 | - | - | 10 | 0 | 6.81M | $4.42 | `audit37-clock` |
| `core` | 35 | 35/33 | 4 | 4 | 2 | 6 |   7.3 |   1.3 | - | - | 6 | 1 | 12.19M | $6.31 | `audit37-core` |
| `core.animation` | 25 | 25/25 | 6 | 6 | 2 | 10 |  15.3 |   5.3 | - | - | 9 | 0 | 15.53M | $8.18 | `audit37-core.animation` |

Totals: 62 distinct findings, 62 fix commits, 1 questions, 65.12M tokens, $45.10.
