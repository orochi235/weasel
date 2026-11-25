# Audit round 86

Blind pairs at `9c4522d63555ec5f264441bcef4cd6a1917eac02` (2026-11-25), run by skulkr. Each area's directory holds its file
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
| `cursor` | 12 | 12/12 | 2 | 5 | 1 | 6 |   8.0 |   2.0 |   4.0 (r85) | 0 in 0 changed | 6 | 0 | 0.71M | $2.20 | $0.183 | `audit86-cursor` |
| `history` | 18 | 18/18 | 2 | 3 | 1 | 4 |   5.0 |   1.0 |   9.0 (r85) | 0 in 0 changed | 5 | 0 | 0.97M | $3.20 | $0.178 | `audit86-history` |
| `registry` | 25 | 25/25 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |   5.0 (r85) | 0 in 0 changed | 7 | 0 | 0.46M | $2.97 | $0.119 | `audit86-registry` |
| `renderer.cache` | 11 | 11/11 | 4 | 2 | 1 | 5 |   6.5 |   1.5 |   2.0 (r85) | 0 in 0 changed | 5 | 0 | 1.73M | $4.91 | $0.446 | `audit86-renderer.cache` |
| `routing.interactions` | 13 | 13/13 | 5 | 3 | 2 | 6 |   7.0 |   1.0 |   4.0 (r85) | 0 in 0 changed | 5 | 0 | 1.10M | $3.29 | $0.253 | `audit86-routing.interactions` |
| `routing.interactions.actions` | 35 | 35/35 | 3 | 5 | 1 | 7 |  11.0 |   4.0 |   1.3 (r85) | 0 in 0 changed | 8 | 0 | 1.64M | $4.87 | $0.139 | `audit86-routing.interactions.actions` |
| `routing.interactions.dispatcher` | 44 | 44/44 | 3 | 6 | 3 | 6 |   6.0 |   0.0 |   2.7 (r85) | 0 in 0 changed | 5 | 0 | 1.39M | $4.31 | $0.098 | `audit86-routing.interactions.dispatcher` |
| `routing.tools` | 25 | 25/25 | 1 | 2 | 0 | 3 |   5.0 |   2.0 |   5.0 (r85) | 0 in 0 changed | 3 | 0 | 1.06M | $3.30 | $0.132 | `audit86-routing.tools` |

Totals: 42 distinct findings, 44 fix commits, 0 questions, 9.05M weighted tokens, $29.05 ($3.63 per area, $0.159 per file).

## Control sweep

The control sweep off (it runs only with --sweep).
