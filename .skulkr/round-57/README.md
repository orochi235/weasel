# Audit round 57

Blind pairs at `c068d53f7e7088a49f2e672ba0dc6f9aac523208` (2026-11-20), run by `scripts/skulk`. Each area's directory holds its file
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
| `text-tools` | 31 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `text.layout` | 30 | 30/0 | 4 | 0 | 0 | 4 |     - |     - | - | - | 0 | 0 | 0.89M | $2.80 | no commits; reviewer B never ran or never finished its report, so no estimate |
| `theme.engine` | 29 | 0/29 | 0 | 8 | 0 | 8 |     - |     - | - | - | 7 | 0 | 1.42M | $4.24 | `audit57-theme.engine`; reviewer A never ran or never finished its report, so no estimate |
| `theme.part1` | 28 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `theme.part2` | 27 | 27/0 | 3 | 0 | 0 | 3 |     - |     - | - | - | 0 | 0 | 0.46M | $1.47 | no commits; reviewer B never ran or never finished its report, so no estimate |
| `ui` | 46 | 0/46 | 0 | 6 | 0 | 6 |     - |     - | - | - | 6 | 0 | 1.18M | $3.61 | `audit57-ui`; reviewer A never ran or never finished its report, so no estimate |
| `ui-canvas` | 38 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `ui-input` | 23 | 23/0 | 4 | 0 | 0 | 4 |     - |     - | - | - | 0 | 0 | 0.53M | $1.71 | no commits; reviewer B never ran or never finished its report, so no estimate |
| `ui-logic` | 9 | 0/9 | 0 | 7 | 0 | 7 |     - |     - | - | - | 0 | 0 | 0.36M | $1.17 | no commits; reviewer A never ran or never finished its report, so no estimate |
| `ui.components.Along` | 47 | 47/0 | 7 | 0 | 0 | 7 |     - |     - | - | - | 9 | 0 | 1.41M | $4.24 | `audit57-ui.components.Along`; reviewer B never ran or never finished its report, so no estimate |
| `ui.components.Badge` | 21 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `ui.components.Badge.bases` | 14 | 14/0 | 8 | 0 | 0 | 8 |     - |     - | - | - | 10 | 0 | 1.22M | $3.73 | `audit57-ui.components.Badge.bases`; reviewer B never ran or never finished its report, so no estimate |
| `ui.components.Badge.shapes` | 24 | 24/24 | 4 | 5 | 1 | 8 |  14.0 |   6.0 | - | - | 9 | 0 | 1.76M | $5.14 | `audit57-ui.components.Badge.shapes`, left out: merge conflict |
| `ui.components.BandEditor` | 16 | 16/16 | 4 | 5 | 2 | 7 |   9.0 |   2.0 | - | - | 7 | 0 | 1.40M | $4.34 | `audit57-ui.components.BandEditor` |
| `ui.components.Bar` | 40 | 40/40 | 6 | 7 | 3 | 10 |  13.0 |   3.0 | - | - | 9 | 0 | 1.98M | $5.87 | `audit57-ui.components.Bar` |
| `ui.components.Button` | 15 | 15/15 | 9 | 7 | 4 | 12 |  15.0 |   3.0 | - | - | 10 | 0 | 1.85M | $5.40 | `audit57-ui.components.Button` |

Totals: 84 distinct findings, 67 fix commits, 0 questions, 14.46M weighted tokens, $43.72.

## Control sweep

The control sweep off (it runs only with --sweep).
