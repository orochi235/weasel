# Audit round 56

Blind pairs at `b8bed07d81b65bf8aef03565da2f604b0db44025` (2026-11-20), run by `scripts/skulk`. Each area's directory holds its file
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
| `text.layout` | 30 | 30/0 | 2 | 0 | 0 | 2 |     - |     - | - | - | 0 | 0 | 1.05M | $3.28 | no commits; reviewer B never ran or never finished its report, so no estimate |
| `theme.engine` | 29 | 0/29 | 0 | 12 | 0 | 12 |     - |     - | - | - | 0 | 0 | 0.76M | $2.38 | no commits; reviewer A never ran or never finished its report, so no estimate |
| `theme.part1` | 28 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `theme.part2` | 27 | 27/0 | 3 | 0 | 0 | 3 |     - |     - | - | - | 3 | 3 | 1.60M | $4.60 | `audit56-theme.part2`; reviewer B never ran or never finished its report, so no estimate |
| `ui` | 46 | 0/44 | 0 | 3 | 0 | 3 |     - |     - | - | - | 0 | 0 | 0.67M | $2.06 | no commits; reviewer A never ran or never finished its report, so no estimate |
| `ui-canvas` | 38 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `ui-input` | 23 | 23/0 | 4 | 0 | 0 | 4 |     - |     - | - | - | 0 | 0 | 0.43M | $1.45 | no commits; reviewer B never ran or never finished its report, so no estimate |
| `ui-logic` | 9 | 0/9 | 0 | 4 | 0 | 4 |     - |     - | - | - | 0 | 0 | 0.35M | $1.16 | no commits; reviewer A never ran or never finished its report, so no estimate |
| `ui.components.Along` | 47 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `ui.components.Badge` | 21 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `ui.components.Badge.bases` | 14 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `ui.components.Badge.effects` | 19 | 19/19 | 8 | 5 | 0 | 13 |  53.0 |  40.0 | - | - | 0 | 0 | 0.59M | $2.04 | no commits |
| `ui.components.Badge.shapes` | 23 | 23/0 | 6 | 0 | 0 | 6 |     - |     - | - | - | 7 | 0 | 0.86M | $2.67 | `audit56-ui.components.Badge.shapes`; reviewer B never ran or never finished its report, so no estimate |
| `ui.components.BandEditor` | 16 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.00M | $0.00 | nothing to fix; reviewer A and B never ran or never finished its report, so no estimate |
| `ui.components.Bar` | 40 | 0/40 | 0 | 8 | 0 | 8 |     - |     - | - | - | 0 | 0 | 0.64M | $2.02 | no commits; reviewer A never ran or never finished its report, so no estimate |

Totals: 55 distinct findings, 10 fix commits, 3 questions, 6.95M weighted tokens, $21.66.

## Control sweep

The control sweep off (it runs only with --sweep).
