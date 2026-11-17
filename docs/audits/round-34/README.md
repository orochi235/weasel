# Audit round 34

Blind pairs at `7192f7a6fc5b8fa10a7ab628983a47025811c0dc` (2026-11-17), run by `scripts/skulk`. Each area's directory holds its file
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
| `apps.draw.src.dev` | 39 | 39/0 | 9 | 0 | 0 | 9 |   9.0 |   0.0 | - | - | 9 | 0 | 4.54M | $7.05 | `audit34-apps.draw.src.dev` |
| `apps.draw.src.modality` | 13 | 13/13 | 2 | 2 | 2 | 2 |   2.0 |   0.0 | - | - | 2 | 0 | 3.27M | $2.46 | `audit34-apps.draw.src.modality` |
| `apps.draw.src.part1` | 38 | 0/0 | 3 | 0 | 0 | 3 |   3.0 |   0.0 | - | - | 3 | 0 | 9.15M | $4.50 | `audit34-apps.draw.src.part1` |
| `apps.draw.src.part2` | 38 | 38/38 | 8 | 6 | 5 | 9 |   9.5 |   0.5 | - | - | 8 | 1 | 19.92M | $9.31 | `audit34-apps.draw.src.part2` |
| `apps.draw.src.part3` | 36 | 36/0 | 7 | 0 | 0 | 7 |   7.0 |   0.0 | - | - | 6 | 0 | 10.46M | $4.73 | `audit34-apps.draw.src.part3`, merged by hand after the night (a test file both it and `apps.draw.src.part1` added to) |
| `apps.draw.src.surfaces` | 16 | 0/0 | 0 | 0 | 0 | 0 |   0.0 |   0.0 | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix |
| `apps.forge` | 17 | 17/17 | 2 | 2 | 0 | 4 |   8.0 |   4.0 | - | - | 6 | 0 | 8.93M | $4.66 | `audit34-apps.forge` |
| `apps.shared` | 10 | 10/10 | 5 | 1 | 1 | 5 |   5.0 |   0.0 | - | - | 5 | 0 | 4.30M | $2.80 | `audit34-apps.shared` |

Totals: 39 distinct findings, 39 fix commits, 1 questions, 60.56M tokens, $35.51.
