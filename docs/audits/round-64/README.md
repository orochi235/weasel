# Audit round 64

Blind pairs at `49e5a07e6aecc7037a5e3692706cf28dd58211c4` (2026-11-21), run by skulkr. Each area's directory holds its file
list (`files.txt`), both reviewers' findings (`A.md`, `B.md`), the matching (`match.json`), the fixer's
report (`fix.md`) and the numbers below (`area.json`). The method is `docs/hardening.md`, "Blind pairs".

"Read" is how many listed files each reviewer says it read. "Est." is Chapman's estimate of what the area held,
"left" that less the distinct findings, and "last left" the previous pass's figure, which this pass tests.
"New code" counts findings citing a file changed since that pass. "Commits" is what the fixer committed.
"Weighted tokens" counts each kind of token at its price against an input token (`TOKEN_WEIGHTS` in skulkr's `src/usage.mjs`); "cost" is list price.
One record per job is in `usage.jsonl`. The shas in `fix.md` are the fixer's, on its node; the same commits
as applied here are `fixCommits` in `area.json`.

| Area | Files | Read A/B | A | B | Shared | Distinct | Est. | Left | Last left | New code | Commits | Questions | Weighted tokens | Cost | Branch |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| `devtools.views` | 37 | 37/37 | 6 | 6 | 1 | 11 |  23.5 |  12.5 |   7.0 (r45) | 0 in 0 changed | 11 | 0 | 2.49M | $7.18 | `audit64-devtools.views` |
| `diagram-formats.mermaid.part2` | 34 | 34/34 | 10 | 9 | 4 | 15 |  21.0 |   6.0 |   4.5 (r46) | 14 in 17 changed | 17 | 0 | 4.02M | $11.93 | `audit64-diagram-formats.mermaid.part2`, left out: merge conflict |
| `diagram.containers` | 12 | 12/12 | 8 | 6 | 1 | 13 |  30.5 |  17.5 |   9.0 (r46) | 1 in 1 changed | 14 | 0 | 2.69M | $11.22 | `audit64-diagram.containers`, left out: merge conflict |
| `diagram.theme` | 10 | 10/10 | 3 | 5 | 1 | 7 |  11.0 |   4.0 |   9.0 (r47) | 0 in 0 changed | 9 | 0 | 1.85M | $10.46 | left out: verify still failing after 2 repairs (1 of 5275 test files failed) |
| `labkit.chrome` | 22 | 22/22 | 5 | 2 | 1 | 6 |   8.0 |   2.0 |   7.5 (r50) | 4 in 11 changed | 7 | 0 | 2.09M | $5.95 | `audit64-labkit.chrome` |
| `p-touch` | 10 | 10/10 | 4 | 4 | 1 | 7 |  11.5 |   4.5 |   6.7 (r53) | 0 in 0 changed | 9 | 0 | 2.60M | $7.78 | `audit64-p-touch`, left out: merge conflict |
| `quantity` | 23 | 23/23 | 8 | 6 | 5 | 9 |   9.5 |   0.5 |   8.0 (r54) | 0 in 0 changed | 12 | 0 | 2.66M | $8.22 | `audit64-quantity`, left out: merge conflict |
| `svg.part1` | 45 | 45/45 | 8 | 7 | 2 | 13 |  23.0 |  10.0 |   9.3 (r55) | 0 in 1 changed | 20 | 0 | 6.10M | $16.81 | `audit64-svg.part1`, left out: merge conflict |
| `text` | 35 | 35/35 | 3 | 4 | 1 | 6 |   9.0 |   3.0 |   6.7 (r55) | 0 in 3 changed | 8 | 0 | 2.60M | $10.37 | `audit64-text`, left out: merge conflict |
| `theme.engine` | 29 | 29/29 | 6 | 4 | 1 | 9 |  16.5 |   7.5 |   6.7 (r60) | 0 in 1 changed | 10 | 0 | 3.43M | $9.93 | `audit64-theme.engine` |
| `ui` | 49 | 48/48 | 4 | 5 | 3 | 6 |   6.5 |   0.5 |  12.0 (r60) | 0 in 3 changed | 14 | 0 | 3.40M | $9.94 | left out: verify still failing after 2 repairs (1 of 5271 test files failed) |
| `ui.components.Menu` | 16 | 16/16 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |   8.0 (r58) | 1 in 1 changed | 5 | 0 | 1.55M | $4.60 | `audit64-ui.components.Menu` |
| `ui.components.Properties.part2` | 36 | 36/36 | 4 | 4 | 2 | 6 |   7.3 |   1.3 |   6.7 (r59) | 0 in 1 changed | 7 | 0 | 2.51M | $7.20 | `audit64-ui.components.Properties.part2` |
| `ui.components.part4` | 46 | 46/46 | 5 | 4 | 0 | 9 |  29.0 |  20.0 |   5.0 (r60) | 0 in 2 changed | 9 | 0 | 2.60M | $7.38 | `audit64-ui.components.part4` |

Totals: 122 distinct findings, 152 fix commits, 0 questions, 40.59M weighted tokens, $128.97.

## Control sweep

The control sweep off (it runs only with --sweep).
