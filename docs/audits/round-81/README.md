# Audit round 81

Blind pairs at `a29c207ab347bcd2f8f1f33d7cb5d12ba4dedfda` (2026-11-24), run by skulkr. Each area's directory holds its file
list (`files.txt`), both reviewers' findings (`A.md`, `B.md`), the matching (`match.json`), the fixer's
report (`fix.md`) and the numbers below (`area.json`). The method is `docs/hardening.md`, "Blind pairs".

"Read" is how many listed files each reviewer says it read. "Est." is Chapman's estimate of what the area held,
"left" that less the distinct findings, and "last left" the previous pass's figure, which this pass tests.
"New code" counts findings citing a file changed since that pass. "Commits" is what the fixer committed.
"Weighted tokens" counts each kind of token at its price against an input token (`TOKEN_WEIGHTS` in skulkr's `src/usage.mjs`); "cost" is list price.
One record per job is in `usage.jsonl`. The shas in `fix.md` are the fixer's, on its node; the same commits
as applied here are `fixCommits` in `area.json`.

| Area | Files | Read A/B | A | B | Shared | Distinct | Est. | Left | Last left | New code | Commits | Questions | Weighted tokens | Cost | Per file | Branch |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| `apps.site.demos.part6` | 48 | 48/48 | 1 | 2 | 0 | 3 |   5.0 |   2.0 |   2.0 (r81) | 0 in 0 changed | 3 | 0 | 0.93M | $2.87 | $0.060 | `audit81-apps.site.demos.part6` |
| `core.interactions.actions.part2` | 26 | 26/26 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |   2.0 (r81) | 0 in 0 changed | 7 | 0 | 1.24M | $3.57 | $0.137 | `audit81-core.interactions.actions.part2` |
| `forge.shell.part1` | 35 | 35/35 | 5 | 1 | 1 | 5 |   5.0 |   0.0 |   0.0 (r81) | 0 in 0 changed | 5 | 0 | 1.43M | $4.14 | $0.118 | `audit81-forge.shell.part1` |
| `forge.vite.part1` | 26 | 26/26 | 6 | 2 | 0 | 8 |  20.0 |  12.0 |  12.0 (r81) | 0 in 0 changed | 8 | 0 | 1.73M | $5.30 | $0.204 | `audit81-forge.vite.part1` |
| `forge.vite.part2` | 26 | 26/26 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |   2.0 (r81) | 0 in 0 changed | 5 | 0 | 1.13M | $3.43 | $0.132 | `audit81-forge.vite.part2`, merged after a conflict repair |
| `renderer.part2` | 38 | 38/38 | 2 | 2 | 1 | 3 |   3.5 |   0.5 |   0.5 (r81) | 0 in 0 changed | 3 | 0 | 1.56M | $4.70 | $0.124 | `audit81-renderer.part2` |
| `ui.components.Badge` | 23 | 23/23 | 4 | 5 | 2 | 7 |   9.0 |   2.0 |   2.0 (r81) | 0 in 0 changed | 5 | 0 | 1.14M | $3.43 | $0.149 | `audit81-ui.components.Badge` |
| `ui.components.part8` | 46 | 46/46 | 5 | 2 | 0 | 7 |  17.0 |  10.0 |  10.0 (r81) | 0 in 0 changed | 8 | 0 | 1.20M | $3.64 | $0.079 | `audit81-ui.components.part8` |

Totals: 43 distinct findings, 44 fix commits, 0 questions, 10.35M weighted tokens, $31.08 ($3.89 per area, $0.116 per file).

## Control sweep

The control sweep off (it runs only with --sweep).
