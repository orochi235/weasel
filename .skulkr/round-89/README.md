# Audit round 89

Blind pairs at `5b35b8d8aacd88cbf6c851b42b50665e64bd75f3` (2026-11-25), run by skulkr. Each area's directory holds its file
list (`files.txt`), both reviewers' findings (`A.md`, `B.md`), the matching (`match.json`), the fixer's
report (`fix.md`) and the numbers below (`area.json`). The method is `docs/hardening.md`, "Blind pairs".

"Read" is how many listed files each reviewer says it read. "Est." is Chapman's estimate of what the area held,
"left" that less the distinct findings, and "last left" the previous pass's figure, which this pass tests.
"New code" counts findings citing a file changed since that pass. "Commits" is what the fixer committed.
"Weighted tokens" counts each kind of token at its price against an input token (`TOKEN_WEIGHTS` in skulkr's `src/usage.mjs`); "cost" is list price.
One record per job is in `usage.jsonl`. The shas in `fix.md` are the fixer's, on its node; the same commits
as applied here are `fixCommits` in `area.json`.

| Area | Files | Read A/B | A | B | Shared | Distinct | Est. | Left | Last left | New code | Commits | Questions | Weighted tokens | Cost | Per file | Branch |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| `cursor` | 12 | 12/12 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |   3.0 (r88) | 0 in 0 changed | 4 | 0 | 0.82M | $2.51 | $0.209 | `audit89-cursor` |
| `history` | 18 | 18/18 | 2 | 2 | 1 | 3 |   3.5 |   0.5 |   3.0 (r88) | 0 in 0 changed | 3 | 0 | 1.04M | $3.59 | $0.199 | `audit89-history` |
| `registry` | 25 | 25/25 | 2 | 0 | 0 | 2 |   2.0 |   0.0 |   6.0 (r88) | 0 in 0 changed | 2 | 0 | 0.63M | $2.24 | $0.090 | `audit89-registry` |
| `renderer.cache` | 11 | 11/11 | 2 | 1 | 0 | 3 |   5.0 |   2.0 |   1.0 (r88) | 0 in 0 changed | 3 | 0 | 0.87M | $2.58 | $0.235 | `audit89-renderer.cache` |
| `routing.interactions` | 14 | 14/14 | 2 | 3 | 0 | 5 |  11.0 |   6.0 |  15.0 (r88) | 0 in 0 changed | 5 | 0 | 0.65M | $2.31 | $0.165 | `audit89-routing.interactions` |
| `routing.interactions.actions` | 36 | 36/36 | 1 | 3 | 0 | 4 |   7.0 |   3.0 |  12.0 (r88) | 0 in 1 changed | 4 | 0 | 1.47M | $4.53 | $0.126 | `audit89-routing.interactions.actions` |
| `routing.interactions.dispatcher` | 44 | 44/44 | 3 | 1 | 0 | 4 |   7.0 |   3.0 |  12.0 (r88) | 0 in 0 changed | 4 | 0 | 1.29M | $4.11 | $0.093 | `audit89-routing.interactions.dispatcher` |
| `routing.tools` | 25 | 25/25 | 3 | 2 | 0 | 5 |  11.0 |   6.0 |   6.0 (r88) | 0 in 0 changed | 5 | 0 | 1.14M | $3.39 | $0.136 | `audit89-routing.tools` |

Totals: 31 distinct findings, 30 fix commits, 0 questions, 7.91M weighted tokens, $25.26 ($3.16 per area, $0.137 per file).

## Control sweep

The control sweep off (it runs only with --sweep).
