# Audit round 66

Blind pairs at `64f0b083bc66bebeb52e9c5a64e5b2587c66b45b` (2026-11-21), run by skulkr. Each area's directory holds its file
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
| `apps.site.demos.part5` | 48 | 48/48 | 6 | 3 | 1 | 8 |  13.0 |   5.0 |   3.9 (r36) | 8 in 33 changed | 9 | 0 | 1.72M | $4.94 | `audit66-apps.site.demos.part5` |
| `core.animation` | 26 | 26/26 | 4 | 2 | 1 | 5 |   6.5 |   1.5 |   7.5 (r38) | 6 in 11 changed | 4 | 0 | 1.54M | $4.42 | `audit66-core.animation` |
| `core.canvas.part1` | 50 | 50/50 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |   9.0 (r63) | 0 in 1 changed | 5 | 0 | 2.07M | $6.09 | `audit66-core.canvas.part1` |
| `core.core.scene.part2` | 40 | 40/40 | 3 | 5 | 1 | 7 |  11.0 |   4.0 |   3.4 (r41) | 2 in 7 changed | 7 | 0 | 1.64M | $4.69 | `audit66-core.core.scene.part2` |
| `core.domains.snap` | 24 | 24/24 | 3 | 4 | 1 | 6 |   9.0 |   3.0 |  10.0 (r42) | 1 in 2 changed | 10 | 1 | 1.82M | $5.06 | `audit66-core.domains.snap` |
| `devtools.views` | 38 | 25/25 | 3 | 3 | 0 | 6 |  15.0 |   9.0 |  12.5 (r64) | 0 in 0 changed | 6 | 0 | 1.11M | $3.31 | `audit66-devtools.views` |
| `diagram-formats.drawXml` | 14 | 14/14 | 3 | 7 | 2 | 8 |   9.7 |   1.7 |  15.0 (r65) | 0 in 0 changed | 8 | 0 | 1.27M | $3.91 | `audit66-diagram-formats.drawXml` |
| `diagram-formats.mermaid.part2` | 34 | 34/34 | 7 | 5 | 2 | 10 |  15.0 |   5.0 |   6.0 (r64) | 9 in 19 changed | 10 | 0 | 2.04M | $6.14 | `audit66-diagram-formats.mermaid.part2` |
| `diagram.containers` | 12 | 12/12 | 4 | 6 | 1 | 9 |  16.5 |   7.5 |  17.5 (r64) | 10 in 7 changed | 7 | 0 | 1.42M | $3.99 | `audit66-diagram.containers` |
| `forge` | 29 | 29/29 | 3 | 4 | 0 | 7 |  19.0 |  12.0 |  10.0 (r65) | 0 in 0 changed | 9 | 0 | 0.93M | $6.74 | `audit66-forge` |
| `labkit.trial.part2` | 26 | 26/26 | 2 | 5 | 1 | 6 |   8.0 |   2.0 |  10.0 (r51) | 2 in 8 changed | 6 | 0 | 1.25M | $3.62 | `audit66-labkit.trial.part2` |
| `path-tools.part2` | 37 | 37/37 | 2 | 2 | 1 | 3 |   3.5 |   0.5 |   5.0 (r53) | 0 in 0 changed | 2 | 0 | 1.19M | $3.63 | `audit66-path-tools.part2` |
| `svg.part1` | 45 | 45/45 | 5 | 2 | 0 | 7 |  17.0 |  10.0 |   9.8 (r64) | 4 in 18 changed | 7 | 0 | 3.24M | $8.86 | `audit66-svg.part1` |
| `svg.part2` | 45 | 45/45 | 8 | 3 | 2 | 9 |  11.0 |   2.0 |  12.0 (r65) | 6 in 15 changed | 11 | 0 | 2.91M | $8.14 | `audit66-svg.part2` |
| `ui.components.TokenPanel` | 11 | 11/11 | 1 | 3 | 1 | 3 |   3.0 |   0.0 |  10.0 (r65) | 0 in 0 changed | 3 | 0 | 0.88M | $2.77 | `audit66-ui.components.TokenPanel` |
| `ui.components.part4` | 46 | 46/46 | 3 | 2 | 0 | 5 |  11.0 |   6.0 |  20.0 (r64) | 0 in 0 changed | 5 | 0 | 1.10M | $3.43 | `audit66-ui.components.part4` |

Totals: 104 distinct findings, 109 fix commits, 1 questions, 26.13M weighted tokens, $79.74.

## Control sweep

The control sweep off (it runs only with --sweep).
