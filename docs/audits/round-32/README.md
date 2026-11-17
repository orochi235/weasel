# Audit round 32

Blind pairs at `402f4984ce970ab4f140a9e9504a66e8770a4ea1` (2026-11-16), run by `scripts/audit-night`. Each area's directory holds its file
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
| `animator` | 34 | 34/34 | 13 | 8 | 5 | 16 |  20.0 |   4.0 | - | - | 12 | 0 | 16.82M | $8.80 | `audit32-animator` |

Totals: 16 distinct findings, 12 fix commits, 0 questions, 16.82M tokens, $8.80.
