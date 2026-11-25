# Audit round 36

Blind pairs at `f16e5466194fff9854ec06b3c556ffe2ef3373f2` (2026-11-18), run by `scripts/skulk`. Each area's directory holds its file
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
| `apps.site.demos.part2` | 49 | 32/46 | 6 | 5 | 2 | 9 |  13.0 |   4.0 | - | - | 8 | 0 | 20.35M | $8.89 | `audit36-apps.site.demos.part2` |
| `apps.site.demos.part3` | 49 | 49/49 | 3 | 2 | 1 | 4 |   5.0 |   1.0 | - | - | 4 | 0 | 11.90M | $6.53 | `audit36-apps.site.demos.part3` |
| `apps.site.demos.part4` | 49 | 49/49 | 5 | 4 | 1 | 8 |  14.0 |   6.0 | - | - | 6 | 2 | 23.04M | $10.21 | `audit36-apps.site.demos.part4` |
| `apps.site.demos.part5` | 48 | 48/48 | 6 | 7 | 4 | 9 |  10.2 |   1.2 | - | - | 9 | 0 | 18.45M | $9.15 | `audit36-apps.site.demos.part5` |
| `apps.site.demos.platformer` | 20 | 20/20 | 11 | 9 | 5 | 15 |  19.0 |   4.0 | - | - | 14 | 0 | 8.28M | $5.33 | `audit36-apps.site.demos.platformer` |
| `apps.theme-editor` | 3 | 3/3 | 4 | 5 | 2 | 7 |   9.0 |   2.0 | - | - | 8 | 0 | 3.30M | $2.59 | `audit36-apps.theme-editor` |
| `apps.theme-editor.src` | 50 | 0/49 | 5 | 10 | 3 | 12 |  15.5 |   3.5 | - | - | 12 | 0 | 31.93M | $13.16 | `audit36-apps.theme-editor.src` |
| `apps.ui-lab` | 28 | 23/28 | 7 | 7 | 4 | 10 |  11.8 |   1.8 | - | - | 14 | 0 | 19.54M | $8.70 | `audit36-apps.ui-lab` |

Totals: 74 distinct findings, 75 fix commits, 2 questions, 136.79M tokens, $64.56.
