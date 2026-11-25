# Audit round 42

Blind pairs at `a31056c5f3adeb20052a681c149c8af782f0f7b5` (2026-11-19), run by `scripts/skulk`. Each area's directory holds its file
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
| `core.domains` | 34 | 34/34 | 4 | 6 | 0 | 10 |  34.0 |  24.0 | - | - | 8 | 0 | 11.95M | $6.61 | `audit42-core.domains` |
| `core.domains.paths` | 22 | 22/0 | 4 | 1 | 0 | 5 |     - |     - | - | - | 0 | 0 | 7.98M | $4.23 | no commits; reviewer B never ran or never finished its report, so no estimate |
| `core.domains.snap` | 24 | 24/24 | 5 | 2 | 0 | 7 |  17.0 |  10.0 | - | - | 0 | 0 | 5.06M | $3.37 | no commits |
| `core.import-shims` | 13 | 13/13 | 4 | 5 | 3 | 6 |   6.5 |   0.5 | - | - | 4 | 0 | 12.85M | $6.01 | `audit42-core.import-shims` |
| `core.interactions.actions.defaults` | 17 | 17/17 | 5 | 3 | 1 | 7 |  11.0 |   4.0 | - | - | 0 | 0 | 6.89M | $4.22 | no commits |
| `core.interactions.actions.part1` | 27 | 27/27 | 4 | 4 | 2 | 6 |   7.3 |   1.3 | - | - | 0 | 0 | 6.89M | $3.91 | no commits |
| `core.interactions.actions.part2` | 26 | 26/26 | 4 | 3 | 1 | 6 |   9.0 |   3.0 | - | - | 0 | 0 | 9.46M | $4.75 | no commits |
| `core.interactions.gestures` | 16 | 16/16 | 4 | 8 | 2 | 10 |  14.0 |   4.0 | - | - | 0 | 0 | 3.57M | $2.64 | no commits |
| `cursor` | 12 | 12/12 | 6 | 6 | 5 | 7 |   7.2 |   0.2 | - | - | 1 | 0 | 3.26M | $3.22 | `audit42-cursor` |
| `d3` | 14 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `devtools` | 18 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `devtools.page` | 12 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `devtools.views` | 37 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `diagram-elk` | 4 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `diagram-formats` | 35 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `diagram-formats.drawXml` | 14 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |

Totals: 64 distinct findings, 13 fix commits, 0 questions, 67.91M tokens, $38.96.

## Control sweep

The control sweep off (it runs only with --sweep).
