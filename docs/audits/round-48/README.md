# Audit round 48

Blind pairs at `7c016ebfdf6a5facdd58c7d93e390fdfdd4ffe84` (2026-11-20), run by `scripts/skulk`. Each area's directory holds its file
list (`files.txt`), both reviewers' findings (`A.md`, `B.md`), the matching (`match.json`), the fixer's
report (`fix.md`) and the numbers below (`area.json`). The method is `docs/hardening.md`, "Blind pairs".

"Read" is how many listed files each reviewer says it read. "Est." is Chapman's estimate of what the area held,
"left" that less the distinct findings, and "last left" the previous pass's figure, which this pass tests.
"New code" counts findings citing a file changed since that pass. "Commits" is what the fixer committed.
"Weighted tokens" counts each kind of token at its price against an input token (`TOKEN_WEIGHTS` in `scripts/skulk/usage.mjs`); "cost" is list price.
One record per job is in `usage.jsonl`. The shas in `fix.md` are the fixer's, on its node; the same commits
as applied here are `fixCommits` in `area.json`.

| Area | Files | Read A/B | A | B | Shared | Distinct | Est. | Left | Last left | New code | Commits | Questions | Weighted tokens | Cost | Branch |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| `forge.frame` | 33 | 33/33 | 5 | 6 | 4 | 7 |   7.4 |   0.4 | - | - | 9 | 0 | 1.61M | $4.84 | `audit48-forge.frame` |
| `forge.shell.cssVars` | 15 | 15/15 | 5 | 5 | 3 | 7 |   8.0 |   1.0 | - | - | 7 | 0 | 1.73M | $5.14 | `audit48-forge.shell.cssVars` |
| `forge.shell.loupe` | 19 | 19/19 | 8 | 8 | 5 | 11 |  12.5 |   1.5 | - | - | 12 | 1 | 3.19M | $8.88 | `audit48-forge.shell.loupe` |
| `forge.shell.part1` | 34 | 34/33 | 6 | 4 | 2 | 8 |  10.7 |   2.7 | - | - | 8 | 0 | 2.03M | $5.92 | `audit48-forge.shell.part1` |
| `forge.shell.part2` | 34 | 34/34 | 2 | 5 | 1 | 6 |   8.0 |   2.0 | - | - | 8 | 0 | 2.68M | $7.73 | `audit48-forge.shell.part2` |
| `forge.story` | 12 | 12/12 | 3 | 2 | 2 | 3 |   3.0 |   0.0 | - | - | 4 | 0 | 0.88M | $2.69 | `audit48-forge.story` |
| `forge.timeline` | 12 | 12/12 | 1 | 1 | 0 | 2 |   3.0 |   1.0 | - | - | 2 | 0 | 0.95M | $2.87 | `audit48-forge.timeline` |
| `forge.vite` | 50 | 50/50 | 5 | 6 | 2 | 9 |  13.0 |   4.0 | - | - | 11 | 0 | 2.65M | $7.76 | `audit48-forge.vite` |

Totals: 53 distinct findings, 61 fix commits, 1 questions, 15.72M weighted tokens, $45.83.

## Control sweep

The control sweep off (it runs only with --sweep).
