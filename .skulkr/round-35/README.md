# Audit round 35

Blind pairs at `197362e015f1498c5cd6691c571634f8fb9575fb` (2026-11-17), run by `scripts/skulk`. Each area's directory holds its file
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
| `apps.draw.src.dev` | 40 | 36/40 | 4 | 5 | 2 | 7 |   9.0 |   2.0 | - | - | 7 | 0 | 13.66M | $7.14 | `audit35-apps.draw.src.dev` |
| `apps.draw.src.part1` | 38 | 38/38 | 2 | 4 | 0 | 6 |  14.0 |   8.0 | - | - | 7 | 0 | 26.23M | $10.87 | `audit35-apps.draw.src.part1` |
| `apps.draw.src.part3` | 36 | 36/36 | 2 | 3 | 0 | 5 |  11.0 |   6.0 | - | - | 3 | 0 | 13.34M | $6.48 | `audit35-apps.draw.src.part3` |
| `apps.draw.src.surfaces` | 16 | 16/16 | 2 | 2 | 0 | 4 |   8.0 |   4.0 | - | - | 3 | 0 | 8.68M | $4.83 | `audit35-apps.draw.src.surfaces` |
| `apps.site` | 44 | 0/42 | 3 | 9 | 2 | 10 |  12.3 |   2.3 | - | - | 10 | 1 | 18.27M | $8.92 | `audit35-apps.site` |
| `apps.site.FrontPage` | 10 | 10/10 | 3 | 2 | 2 | 3 |   3.0 |   0.0 | - | - | 3 | 0 | 4.77M | $3.17 | `audit35-apps.site.FrontPage` |
| `apps.site.Packages` | 18 | 18/18 | 3 | 5 | 2 | 6 |   7.0 |   1.0 | - | - | 6 | 0 | 7.52M | $4.17 | `audit35-apps.site.Packages` |
| `apps.site.demos.part1` | 49 | 49/49 | 7 | 5 | 3 | 9 |  11.0 |   2.0 | - | - | 9 | 0 | 15.60M | $7.98 | `audit35-apps.site.demos.part1` |

Totals: 50 distinct findings, 48 fix commits, 1 questions, 108.08M tokens, $53.56.
