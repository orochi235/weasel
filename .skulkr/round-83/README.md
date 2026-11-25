# Audit round 83

Blind pairs at `e9f6aefb6511d9f3a0fcea1ba8641667fcf1861a` (2026-11-24), run by skulkr. Each area's directory holds its file
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
| `editing.actions` | 35 | 35/35 | 5 | 5 | 1 | 9 |  17.0 |   8.0 |   8.0 (r83) | 0 in 0 changed | 8 | 0 | 2.38M | $6.43 | $0.184 | `audit83-editing.actions` |
| `editing.actions.move` | 33 | 33/33 | 5 | 7 | 1 | 11 |  23.0 |  12.0 |  12.0 (r83) | 0 in 0 changed | 9 | 0 | 0.78M | $6.88 | $0.208 | `audit83-editing.actions.move` |
| `forge.vite.part1` | 27 | 27/27 | 5 | 7 | 2 | 10 |  15.0 |   5.0 |   5.0 (r83) | 0 in 0 changed | 10 | 0 | 1.89M | $5.54 | $0.205 | `audit83-forge.vite.part1` |
| `geom.booleans` | 32 | 32/32 | 3 | 3 | 0 | 6 |  15.0 |   9.0 |   9.0 (r83) | 0 in 0 changed | 5 | 0 | 1.89M | $6.23 | $0.195 | `audit83-geom.booleans` |
| `geom.part1` | 42 | 42/42 | 3 | 2 | 1 | 4 |   5.0 |   1.0 |   1.0 (r83) | 0 in 0 changed | 4 | 0 | 0.83M | $3.69 | $0.088 | `audit83-geom.part1` |
| `history` | 17 | 17/17 | 7 | 8 | 3 | 12 |  17.0 |   5.0 |   5.0 (r83) | 0 in 0 changed | 13 | 0 | 0.57M | $5.99 | $0.352 | `audit83-history` |
| `labkit.loupe.lens` | 33 | 33/33 | 5 | 3 | 2 | 6 |   7.0 |   1.0 |   1.0 (r83) | 0 in 0 changed | 5 | 0 | 0.91M | $4.22 | $0.128 | `audit83-labkit.loupe.lens` |
| `ui.components.Properties.part1` | 37 | 37/37 | 2 | 5 | 1 | 6 |   8.0 |   2.0 |   2.0 (r83) | 0 in 0 changed | 6 | 0 | 1.13M | $3.37 | $0.091 | `audit83-ui.components.Properties.part1` |

Totals: 64 distinct findings, 60 fix commits, 0 questions, 10.38M weighted tokens, $42.35 ($5.29 per area, $0.165 per file).

## Control sweep

The control sweep off (it runs only with --sweep).
