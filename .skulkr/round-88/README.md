# Audit round 88

Blind pairs at `01e37b5e5c7a6376427032c06b5dce134bc725d8` (2026-11-25), run by skulkr. Each area's directory holds its file
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
| `cursor` | 12 | 12/12 | 5 | 5 | 2 | 8 |  11.0 |   3.0 |   0.0 (r87) | 0 in 0 changed | 8 | 0 | 1.19M | $3.56 | $0.297 | `audit88-cursor` |
| `history` | 18 | 18/18 | 3 | 1 | 0 | 4 |   7.0 |   3.0 |   8.0 (r87) | 0 in 0 changed | 3 | 0 | 0.90M | $4.80 | $0.267 | `audit88-history` |
| `registry` | 25 | 25/25 | 3 | 2 | 0 | 5 |  11.0 |   6.0 |   2.0 (r87) | 0 in 0 changed | 5 | 0 | 0.90M | $2.82 | $0.113 | `audit88-registry` |
| `renderer.cache` | 11 | 11/11 | 1 | 1 | 0 | 2 |   3.0 |   1.0 |   1.5 (r86) | 0 in 0 changed | 2 | 0 | 1.24M | $3.62 | $0.329 | `audit88-renderer.cache` |
| `routing.interactions` | 14 | 14/14 | 3 | 5 | 0 | 8 |  23.0 |  15.0 |   3.0 (r87) | 0 in 0 changed | 10 | 0 | 1.74M | $5.25 | $0.375 | `audit88-routing.interactions` |
| `routing.interactions.actions` | 36 | 36/36 | 4 | 3 | 0 | 7 |  19.0 |  12.0 |   4.0 (r86) | 0 in 0 changed | 6 | 0 | 0.88M | $5.67 | $0.158 | `audit88-routing.interactions.actions` |
| `routing.interactions.dispatcher` | 44 | 44/44 | 3 | 4 | 0 | 7 |  19.0 |  12.0 |   0.0 (r86) | 0 in 0 changed | 7 | 0 | 2.72M | $7.30 | $0.166 | `audit88-routing.interactions.dispatcher` |
| `routing.tools` | 25 | 25/25 | 4 | 5 | 1 | 8 |  14.0 |   6.0 |   0.5 (r87) | 0 in 0 changed | 9 | 0 | 0.54M | $1.77 | $0.071 | `audit88-routing.tools` |

Totals: 49 distinct findings, 50 fix commits, 0 questions, 10.11M weighted tokens, $34.79 ($4.35 per area, $0.188 per file).

## Control sweep

The control sweep off (it runs only with --sweep).
