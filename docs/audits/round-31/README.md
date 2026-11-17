# Audit round 31

Blind pairs at `2af3a3aa4c66a58347f138b28ec33ca219128469` (2026-11-16), run by `scripts/audit-night`. Each area's directory holds its file
list (`files.txt`), both reviewers' findings (`A.md`, `B.md`), the matching (`match.json`), the fixer's
report (`fix.md`) and the numbers below (`area.json`). The method is `docs/hardening.md`, "Blind pairs".

"Read" is how many listed files each reviewer says it read. "Est." is Chapman's estimate of what the area held,
"left" that less the distinct findings, and "last left" the previous pass's figure, which this pass tests.
"New code" counts findings citing a file changed since that pass. "Commits" is what the fixer committed.
"Tokens" adds input, output, cache creation and cache reads over the area's jobs; "cost" is list price.
One record per job is in `usage.jsonl`.

| Area | Files | Read A/B | A | B | Shared | Distinct | Est. | Left | Last left | New code | Commits | Questions | Tokens | Cost | Branch |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| `parallax` | 6 | 6/6 | 2 | 3 | 2 | 3 |   3.0 |   0.0 | - | - | 3 | 0 | 2.32M | $2.20 | `audit31-parallax` |

Totals: 3 distinct findings, 3 fix commits, 0 questions, 2.32M tokens, $2.20.
