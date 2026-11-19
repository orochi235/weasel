# Audit round 38

Blind pairs at `aac71b545ef36621a62610a7cc0bf3665162b2e5` (2026-11-18), run by `scripts/skulk`. Each area's directory holds its file
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
| `audio` | 46 | 45/45 | 11 | 8 | 6 | 13 |  14.4 |   1.4 | - | - | 19 | 0 | 25.87M | $11.80 | `audit38-audio` |
| `audio.graph` | 13 | 13/13 | 4 | 5 | 3 | 6 |   6.5 |   0.5 | - | - | 7 | 0 | 8.61M | $5.74 | `audit38-audio.graph`, left out: merge conflict |
| `audio.testing` | 13 | 13/13 | 11 | 8 | 7 | 12 |  12.5 |   0.5 | - | - | 11 | 0 | 5.77M | $3.99 | `audit38-audio.testing` |
| `bidi` | 11 | 11/11 | 1 | 2 | 0 | 3 |   5.0 |   2.0 | - | - | 3 | 0 | 3.93M | $3.79 | `audit38-bidi` |
| `brush` | 2 | 2/2 | 1 | 1 | 1 | 1 |   1.0 |   0.0 | - | - | 1 | 0 | 2.00M | $1.79 | `audit38-brush` |
| `clock` | 13 | 13/13 | 4 | 6 | 3 | 7 |   7.8 |   0.8 | - | - | 8 | 0 | 4.88M | $3.55 | `audit38-clock` |
| `core` | 35 | 35/35 | 4 | 7 | 2 | 9 |  12.3 |   3.3 | - | - | 9 | 0 | 17.90M | $8.75 | `audit38-core` |
| `core.animation` | 25 | 25/25 | 4 | 6 | 1 | 9 |  16.5 |   7.5 | - | - | 8 | 0 | 13.60M | $7.69 | `audit38-core.animation` |

Totals: 60 distinct findings, 66 fix commits, 0 questions, 82.57M tokens, $47.10.
