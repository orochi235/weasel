# Audit round 67

Blind pairs at `a2dfd0456e1787d352e92d6a6a6ad07fce7f5229` (2026-11-22), run by skulkr. Each area's directory holds its file
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
| `core.debug` | 12 | 12/12 | 2 | 3 | 2 | 3 |   3.0 |   0.0 |   8.0 (r41) | 1 in 1 changed | 3 | 0 | 0.76M | $2.24 | `audit67-core.debug` |
| `devtools.views` | 38 | 25/38 | 6 | 1 | 0 | 7 |  13.0 |   6.0 |   9.0 (r66) | 0 in 0 changed | 8 | 0 | 1.47M | $4.39 | `audit67-devtools.views` |
| `diagram.containers` | 12 | 12/12 | 5 | 2 | 0 | 7 |  17.0 |  10.0 |   7.5 (r66) | 0 in 0 changed | 7 | 0 | 1.35M | $3.91 | `audit67-diagram.containers`, left out: merge conflict in packages/diagram/src/containers/trait.ts |
| `diagram.layered` | 18 | 18/18 | 2 | 3 | 1 | 4 |   5.0 |   1.0 |   8.0 (r46) | 0 in 0 changed | 5 | 0 | 1.38M | $4.34 | `audit67-diagram.layered`, left out: merge conflict in apps/chart/src/importExport.test.tsx |
| `forge` | 29 | 29/29 | 3 | 4 | 0 | 7 |  19.0 |  12.0 |  12.0 (r66) | 0 in 0 changed | 4 | 0 | 1.24M | $3.89 | `audit67-forge` |
| `geom.paths.part1` | 38 | 38/38 | 4 | 5 | 2 | 7 |   9.0 |   2.0 |   8.0 (r49) | 2 in 3 changed | 7 | 0 | 1.64M | $5.08 | `audit67-geom.paths.part1` |
| `icons` | 15 | 15/15 | 1 | 3 | 1 | 3 |   3.0 |   0.0 |   8.0 (r50) | 0 in 0 changed | 5 | 0 | 0.51M | $2.73 | `audit67-icons` |
| `labkit.annotations` | 50 | 50/50 | 5 | 5 | 2 | 8 |  11.0 |   3.0 |   3.0 (r50) | 6 in 18 changed | 8 | 0 | 1.93M | $5.59 | `audit67-labkit.annotations` |
| `svg.part1` | 45 | 45/45 | 3 | 4 | 2 | 5 |   5.7 |   0.7 |  10.0 (r66) | 0 in 1 changed | 7 | 0 | 3.51M | $9.88 | `audit67-svg.part1` |
| `theme.engine` | 29 | 29/29 | 3 | 4 | 0 | 7 |  19.0 |  12.0 |   7.5 (r64) | 0 in 0 changed | 6 | 0 | 1.84M | $5.44 | `audit67-theme.engine` |
| `ui.components.Badge.effects` | 21 | 21/21 | 5 | 4 | 1 | 8 |  14.0 |   6.0 |   6.7 (r65) | 5 in 14 changed | 7 | 0 | 0.92M | $2.86 | `audit67-ui.components.Badge.effects` |
| `ui.components.Bar` | 41 | 41/41 | 5 | 4 | 2 | 7 |   9.0 |   2.0 |   3.0 (r57) | 6 in 8 changed | 6 | 0 | 1.42M | $4.14 | `audit67-ui.components.Bar` |
| `ui.components.Button` | 15 | 15/15 | 4 | 3 | 3 | 4 |   4.0 |   0.0 |   3.0 (r57) | 4 in 1 changed | 5 | 0 | 0.73M | $2.20 | `audit67-ui.components.Button` |
| `ui.components.CurveEditor` | 33 | 33/33 | 6 | 3 | 2 | 7 |   8.3 |   1.3 |   3.2 (r65) | 6 in 9 changed | 6 | 0 | 1.86M | $5.55 | `audit67-ui.components.CurveEditor` |
| `ui.components.GradientEditor` | 14 | 14/14 | 3 | 4 | 2 | 5 |   5.7 |   0.7 |   3.0 (r58) | 3 in 2 changed | 5 | 0 | 0.94M | $2.84 | `audit67-ui.components.GradientEditor` |
| `ui.components.part10` | 38 | 38/38 | 4 | 5 | 1 | 8 |  14.0 |   6.0 |   3.2 (r59) | 9 in 11 changed | 7 | 0 | 1.42M | $4.02 | `audit67-ui.components.part10` |

Totals: 97 distinct findings, 96 fix commits, 0 questions, 22.91M weighted tokens, $69.10.

## Control sweep

The control sweep off (it runs only with --sweep).
