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
| `cursor` | 12 | 12/12 | 2 | 5 | 1 | 6 |   8.0 |   2.0 |   2.0 (r86) | 0 in 0 changed | 6 | 0 | 0.71M | $2.20 | $0.183 | `audit86-cursor` |
| `history` | 18 | 18/18 | 2 | 3 | 1 | 4 |   5.0 |   1.0 |   1.0 (r86) | 0 in 0 changed | 5 | 0 | 0.97M | $3.20 | $0.178 | `audit86-history` |
| `registry` | 25 | 25/25 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |   2.0 (r86) | 0 in 0 changed | 7 | 0 | 0.46M | $2.97 | $0.119 | `audit86-registry` |
| `routing.interactions` | 13 | 13/13 | 5 | 3 | 2 | 6 |   7.0 |   1.0 |   1.0 (r86) | 0 in 0 changed | 5 | 0 | 1.10M | $3.29 | $0.253 | `audit86-routing.interactions` |
| `routing.tools` | 25 | 25/25 | 1 | 2 | 0 | 3 |   5.0 |   2.0 |   2.0 (r86) | 0 in 0 changed | 3 | 0 | 1.06M | $3.30 | $0.132 | `audit86-routing.tools` |

Totals: 24 distinct findings, 26 fix commits, 0 questions, 4.29M weighted tokens, $14.96 ($2.99 per area, $0.161 per file).

## Control sweep

The control sweep off (it runs only with --sweep).
