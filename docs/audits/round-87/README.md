# Audit round 87

Blind pairs at `841da92f13a15f3f4f46052210ffae37ee4963ea` (2026-11-25), run by skulkr. Each area's directory holds its file
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
| `cursor` | 12 | 12/12 | 2 | 5 | 2 | 5 |   5.0 |   0.0 |   2.0 (r86) | 0 in 0 changed | 7 | 0 | 0.95M | $2.79 | $0.233 | `audit87-cursor` |
| `editing.actions` | 35 | 35/35 | 5 | 4 | 1 | 8 |  14.0 |   6.0 |   4.5 (r84) | 0 in 0 changed | 5 | 0 | 1.41M | $4.15 | $0.119 | `audit87-editing.actions` |
| `editing.actions.move` | 33 | 33/33 | 4 | 3 | 2 | 5 |   5.7 |   0.7 |   6.0 (r84) | 0 in 0 changed | 4 | 0 | 1.43M | $4.51 | $0.137 | `audit87-editing.actions.move` |
| `forge.vite.part1` | 27 | 27/27 | 4 | 4 | 1 | 7 |  11.5 |   4.5 |   6.0 (r84) | 0 in 0 changed | 7 | 0 | 1.29M | $4.19 | $0.155 | `audit87-forge.vite.part1` |
| `history` | 18 | 18/18 | 4 | 2 | 0 | 6 |  14.0 |   8.0 |   1.0 (r86) | 0 in 0 changed | 6 | 0 | 1.46M | $4.95 | $0.275 | `audit87-history` |
| `registry` | 25 | 25/25 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |   2.0 (r86) | 0 in 0 changed | 5 | 0 | 0.79M | $2.51 | $0.100 | `audit87-registry` |
| `routing.interactions` | 14 | 14/14 | 5 | 5 | 2 | 8 |  11.0 |   3.0 |   1.0 (r86) | 0 in 0 changed | 8 | 0 | 1.00M | $2.95 | $0.211 | `audit87-routing.interactions` |
| `routing.tools` | 25 | 25/25 | 2 | 2 | 1 | 3 |   3.5 |   0.5 |   2.0 (r86) | 0 in 0 changed | 3 | 0 | 1.13M | $3.35 | $0.134 | `audit87-routing.tools` |

Totals: 47 distinct findings, 45 fix commits, 0 questions, 9.46M weighted tokens, $29.40 ($3.68 per area, $0.156 per file).

## Control sweep

The control sweep off (it runs only with --sweep).
