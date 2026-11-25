# Audit round 60

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
| `animator.timeline` | 17 | 17/17 | 5 | 7 | 4 | 8 |   8.6 |   0.6 |   1.2 (r33) | 9 in 7 changed | 8 | 0 | 1.93M | $5.83 | `audit60-animator.timeline` |
| `apps.site.demos.part4` | 48 | 48/48 | 2 | 2 | 1 | 3 |   3.5 |   0.5 |   2.3 (r36) | 2 in 27 changed | 3 | 0 | 2.36M | $6.77 | `audit60-apps.site.demos.part4` |
| `core.canvas.part2` | 50 | 50/50 | 4 | 7 | 4 | 7 |   7.0 |   0.0 |   1.3 (r39) | 7 in 14 changed | 7 | 0 | 3.38M | $9.48 | `audit60-core.canvas.part2` |
| `theme.engine` | 29 | 29/29 | 7 | 6 | 2 | 11 |  17.7 |   6.7 | - | - | 11 | 0 | 2.71M | $7.94 | `audit60-theme.engine` |
| `ui` | 46 | 45/45 | 9 | 4 | 1 | 12 |  24.0 |  12.0 | - | - | 14 | 0 | 3.45M | $9.73 | `audit60-ui` |
| `ui.components.Along` | 47 | 47/47 | 5 | 7 | 2 | 10 |  15.0 |   5.0 | - | - | 10 | 0 | 2.23M | $6.71 | `audit60-ui.components.Along` |
| `ui.components.Badge.bases` | 14 | 14/14 | 8 | 7 | 6 | 9 |   9.3 |   0.3 | - | - | 8 | 0 | 2.64M | $7.84 | `audit60-ui.components.Badge.bases`, left out: merge conflict |
| `ui.components.part2` | 46 | 46/46 | 8 | 8 | 5 | 11 |  12.5 |   1.5 | - | - | 11 | 0 | 2.35M | $6.86 | `audit60-ui.components.part2` |
| `ui.components.part3` | 46 | 46/46 | 9 | 8 | 6 | 11 |  11.9 |   0.9 | - | - | 10 | 0 | 2.65M | $7.66 | `audit60-ui.components.part3` |
| `ui.components.part4` | 46 | 46/46 | 8 | 7 | 3 | 12 |  17.0 |   5.0 | - | - | 14 | 0 | 2.97M | $8.46 | `audit60-ui.components.part4` |
| `ui.components.part5` | 46 | 46/46 | 11 | 4 | 3 | 12 |  14.0 |   2.0 | - | - | 16 | 0 | 2.68M | $7.66 | `audit60-ui.components.part5`, left out: merge conflict |
| `ui.components.part6` | 46 | 46/46 | 8 | 5 | 3 | 10 |  12.5 |   2.5 | - | - | 10 | 0 | 2.61M | $7.54 | `audit60-ui.components.part6` |
| `ui.components.part7` | 46 | 46/46 | 6 | 6 | 5 | 7 |   7.2 |   0.2 | - | - | 7 | 0 | 1.43M | $4.43 | `audit60-ui.components.part7` |
| `ui.components.part8` | 46 | 46/46 | 7 | 2 | 1 | 8 |  11.0 |   3.0 | - | - | 8 | 0 | 2.52M | $7.36 | `audit60-ui.components.part8`, left out: merge conflict |
| `ui.components.part9` | 46 | 46/46 | 5 | 4 | 3 | 6 |   6.5 |   0.5 | - | - | 9 | 0 | 2.05M | $6.00 | `audit60-ui.components.part9` |
| `ui.testing` | 14 | 14/14 | 5 | 7 | 3 | 9 |  11.0 |   2.0 | - | - | 7 | 0 | 1.70M | $4.99 | `audit60-ui.testing` |

Totals: 146 distinct findings, 153 fix commits, 0 questions, 39.67M weighted tokens, $115.26.

## Control sweep

The control sweep off (it runs only with --sweep).
