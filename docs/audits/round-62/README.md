# Audit round 62

Blind pairs at `1b4edb3a93db1759496d564da57eb13020b3d7d2` (2026-11-20), run by skulkr. Each area's directory holds its file
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
| `apps.chart.src.part1` | 27 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.06M | $0.23 | no commits |
| `audio` | 47 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.14M | $0.50 | no commits |
| `core.animation` | 26 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.12M | $0.42 | no commits |
| `core.barrel` | 15 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.06M | $0.22 | no commits |
| `core.domains` | 34 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 2 | 0 | 0.93M | $2.71 | `audit62-core.domains` |
| `core.domains.paths` | 22 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 4 | 0 | 1.19M | $3.44 | `audit62-core.domains.paths`, left out: merge conflict |
| `core.domains.snap` | 24 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 10 | 0 | 1.98M | $5.44 | left out: verify still failing after 2 repairs (1 of 5230 test files failed) |
| `core.import-shims` | 13 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 2 | 0 | 0.27M | $0.85 | `audit62-core.import-shims` |
| `core.interactions.actions.defaults` | 17 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 8 | 0 | 1.52M | $4.20 | `audit62-core.interactions.actions.defaults`, left out: merge conflict |
| `core.interactions.actions.part1` | 27 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 10 | 0 | 0.43M | $3.52 | `audit62-core.interactions.actions.part1`, left out: merge conflict |
| `core.interactions.actions.part2` | 26 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 8 | 0 | 1.78M | $5.02 | left out: verify still failing after 2 repairs (1 of 5231 test files failed) |
| `core.interactions.gestures` | 16 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 11 | 0 | 1.14M | $3.35 | `audit62-core.interactions.gestures`, left out: merge conflict |
| `cursor` | 12 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 7 | 0 | 1.08M | $3.27 | left out: verify still failing after 2 repairs (7 of 527 test files failed) |
| `forge` | 29 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 1 | 0.19M | $0.62 | no commits |
| `menu` | 15 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 0 | 0 | 0.10M | $0.35 | no commits |
| `text.layout` | 30 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 6 | 0 | 1.17M | $3.36 | `audit62-text.layout`, left out: merge conflict |
| `theme.part2` | 27 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 6 | 0 | 1.01M | $3.08 | left out: verify still failing after 2 repairs (1 of 463 test files failed) |
| `ui-input` | 23 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 5 | 0 | 0.84M | $2.62 | `audit62-ui-input`, left out: merge conflict |
| `ui-logic` | 9 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 1 | 0 | 0.16M | $0.51 | `audit62-ui-logic` |
| `ui.components.Badge.effects` | 19 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 8 | 0 | 0.74M | $2.29 | `audit62-ui.components.Badge.effects` |
| `ui.components.Bar` | 40 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 5 | 0 | 0.68M | $1.99 | `audit62-ui.components.Bar`, left out: merge conflict |
| `ui.components.CurveEditor` | 33 | 0/0 | 0 | 0 | 0 | 0 |     - |     - | - | - | 1 | 0 | 0.16M | $0.53 | `audit62-ui.components.CurveEditor` |

Totals: 0 distinct findings, 94 fix commits, 1 questions, 15.73M weighted tokens, $48.52.

## Control sweep

The control sweep off (it runs only with --sweep).
