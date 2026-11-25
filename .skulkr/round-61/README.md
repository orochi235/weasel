# Audit round 61

Blind pairs at `deaf03bd8ed407174fa289a1262d2699ffbe97db` (2026-11-20), run by skulkr. Each area's directory holds its file
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
| `ui.components.Badge` | 22 | 22/22 | 6 | 4 | 2 | 8 |  10.7 |   2.7 | - | - | 8 | 2 | 1.81M | $5.37 | `audit61-ui.components.Badge` |

Totals: 8 distinct findings, 8 fix commits, 2 questions, 1.81M weighted tokens, $5.37.

## Control sweep

The control sweep off (it runs only with --sweep).
