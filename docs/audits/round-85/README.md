# Audit round 85

Blind pairs at `2deb4d3b86eff8c016b33bf760a4260ea3a22762` (2026-11-24), run by skulkr. Each area's directory holds its file
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
| `cursor` | 12 | 12/12 | 8 | 9 | 4 | 13 |  17.0 |   4.0 |   0.2 (r42) | 0 in 0 changed | 15 | 0 | 1.65M | $4.64 | $0.387 | `audit85-cursor` |
| `history` | 18 | 18/18 | 3 | 3 | 0 | 6 |  15.0 |   9.0 |   1.0 (r84) | 0 in 0 changed | 7 | 0 | 1.45M | $4.63 | $0.257 | `audit85-history` |
| `registry` | 25 | 25/25 | 5 | 1 | 0 | 6 |  11.0 |   5.0 |   0.0 (r54) | 1 in 2 changed | 6 | 0 | 0.87M | $2.74 | $0.110 | `audit85-registry`, landed early at 0848d1576e |
| `renderer.cache` | 11 | 11/11 | 2 | 5 | 1 | 6 |   8.0 |   2.0 |   0.0 (r54) | 1 in 2 changed | 6 | 0 | 1.13M | $3.30 | $0.300 | `audit85-renderer.cache`, landed early at 0848d1576e |
| `routing.interactions` | 13 | 13/13 | 3 | 5 | 1 | 7 |  11.0 |   4.0 |   0.0 (r55) | 0 in 0 changed | 8 | 0 | 1.72M | $5.03 | $0.387 | `audit85-routing.interactions` |
| `routing.interactions.actions` | 35 | 35/35 | 4 | 4 | 2 | 6 |   7.3 |   1.3 |   0.3 (r55) | 2 in 5 changed | 7 | 0 | 1.06M | $3.48 | $0.099 | `audit85-routing.interactions.actions`, landed early at 0848d1576e |
| `routing.interactions.dispatcher` | 44 | 44/44 | 6 | 4 | 2 | 8 |  10.7 |   2.7 |   0.8 (r55) | 0 in 2 changed | 8 | 0 | 2.02M | $5.98 | $0.136 | `audit85-routing.interactions.dispatcher`, landed early at 0848d1576e |
| `routing.tools` | 25 | 25/25 | 7 | 5 | 2 | 10 |  15.0 |   5.0 |   0.0 (r55) | 0 in 1 changed | 14 | 0 | 1.50M | $5.13 | $0.205 | `audit85-routing.tools` |

Totals: 62 distinct findings, 71 fix commits, 0 questions, 11.38M weighted tokens, $34.93 ($4.37 per area, $0.191 per file).

## Control sweep

The control sweep off (it runs only with --sweep).
