# Audit round 45

Blind pairs at `04c3a6536306f9e757e77a6ab15759ff43b02241` (2026-11-19), run by `scripts/skulk`. Each area's directory holds its file
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
| `apps.draw.src.dev.audits` | 32 | 32/32 | 7 | 8 | 3 | 12 |  17.0 |   5.0 | - | - | 11 | 0 | 8.63M | $5.22 | `audit45-apps.draw.src.dev.audits` |
| `apps.draw.src.dev.detail` | 11 | 11/11 | 2 | 5 | 1 | 6 |   8.0 |   2.0 | - | - | 5 | 0 | 7.43M | $4.36 | `audit45-apps.draw.src.dev.detail` |
| `core.domains.paths` | 22 | 22/22 | 4 | 3 | 2 | 5 |   5.7 |   0.7 | - | - | 5 | 0 | 10.14M | $5.80 | `audit45-core.domains.paths` |
| `d3` | 14 | 14/14 | 6 | 10 | 5 | 11 |  11.8 |   0.8 | - | - | 17 | 0 | 3.66M | $7.58 | `audit45-d3` |
| `devtools` | 18 | 18/18 | 7 | 4 | 4 | 7 |   7.0 |   0.0 | - | - | 6 | 0 | 11.08M | $6.03 | `audit45-devtools` |
| `devtools.page` | 12 | 12/12 | 8 | 6 | 6 | 8 |   8.0 |   0.0 | - | - | 9 | 0 | 13.80M | $7.21 | `audit45-devtools.page`, left out: merge conflict |
| `devtools.views` | 37 | 37/37 | 3 | 8 | 1 | 10 |  17.0 |   7.0 | - | - | 9 | 0 | 15.89M | $7.95 | `audit45-devtools.views` |
| `diagram-elk` | 4 | 4/4 | 5 | 3 | 2 | 6 |   7.0 |   1.0 | - | - | 5 | 0 | 4.08M | $3.39 | `audit45-diagram-elk` |

Totals: 65 distinct findings, 67 fix commits, 0 questions, 74.71M tokens, $47.54.

## Control sweep

The control sweep off (it runs only with --sweep).
