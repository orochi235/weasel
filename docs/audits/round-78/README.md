# Audit round 78

Blind pairs at `9a2362dfc40bfba329a811ef1e04528605c185ff` (2026-11-23), run by skulkr. Each area's directory holds its file
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
| `apps.site.demos.part2` | 48 | 48/48 | 3 | 5 | 3 | 5 |   5.0 |   0.0 |   2.9 (r36) | 2 in 28 changed | 5 | 0 | 1.35M | $3.91 | `audit78-apps.site.demos.part2`, landed early at c558c217f3 |
| `apps.theme-editor.src` | 50 | 50/50 | 4 | 3 | 0 | 7 |  19.0 |  12.0 |   4.5 (r77) | 0 in 0 changed | 8 | 0 | 2.14M | $6.24 | `audit78-apps.theme-editor.src`, landed early at c558c217f3 |
| `audio` | 47 | 47/47 | 10 | 7 | 2 | 15 |  28.3 |  13.3 |   4.0 (r74) | 0 in 0 changed | 14 | 0 | 2.83M | $8.96 | `audit78-audio`, landed early at c558c217f3 |
| `devtools.views` | 40 | 40/40 | 2 | 1 | 0 | 3 |   5.0 |   2.0 |   6.0 (r77) | 0 in 0 changed | 3 | 0 | 1.21M | $3.60 | `audit78-devtools.views`, landed early at c558c217f3 |
| `diagram.effect.part1` | 31 | 31/31 | 1 | 2 | 0 | 3 |   5.0 |   2.0 |   4.0 (r74) | 0 in 0 changed | 3 | 0 | 1.24M | $3.85 | `audit78-diagram.effect.part1`, landed early at c558c217f3 |
| `font.outline` | 15 | 15/15 | 4 | 4 | 0 | 8 |  24.0 |  16.0 |   4.0 (r76) | 0 in 0 changed | 10 | 0 | 1.89M | $5.51 | `audit78-font.outline` |
| `forge.vite` | 50 | 50/50 | 9 | 5 | 3 | 11 |  14.0 |   3.0 |   8.0 (r77) | 0 in 0 changed | 14 | 0 | 2.13M | $6.28 | `audit78-forge.vite`, landed early at c558c217f3 |
| `gestures` | 43 | 43/43 | 6 | 5 | 1 | 10 |  20.0 |  10.0 |   1.5 (r76) | 0 in 0 changed | 6 | 0 | 1.59M | $4.96 | `audit78-gestures` |
| `icons-plugin` | 12 | 12/12 | 6 | 6 | 3 | 9 |  11.3 |   2.3 |   2.7 (r50) | 10 in 6 changed | 12 | 0 | 0.71M | $4.52 | `audit78-icons-plugin` |
| `prefs-schema` | 31 | 31/31 | 1 | 3 | 0 | 4 |   7.0 |   3.0 |  10.0 (r77) | 0 in 0 changed | 4 | 0 | 1.17M | $3.74 | `audit78-prefs-schema`, landed early at c558c217f3 |
| `renderer.part2` | 38 | 38/38 | 9 | 7 | 1 | 15 |  39.0 |  24.0 |   1.3 (r54) | 4 in 11 changed | 16 | 0 | 3.14M | $8.46 | `audit78-renderer.part2` |
| `text` | 35 | 35/35 | 2 | 2 | 1 | 3 |   3.5 |   0.5 |   3.0 (r64) | 2 in 12 changed | 2 | 0 | 1.39M | $4.19 | `audit78-text` |
| `text-dom` | 36 | 36/36 | 4 | 2 | 1 | 5 |   6.5 |   1.5 |   5.0 (r77) | 0 in 0 changed | 5 | 0 | 2.07M | $6.47 | `audit78-text-dom`, landed early at c558c217f3 |
| `tiles` | 5 | 5/5 | 2 | 4 | 0 | 6 |  14.0 |   8.0 |   4.0 (r72) | 0 in 0 changed | 8 | 0 | 0.85M | $2.67 | `audit78-tiles`, landed early at c558c217f3 |
| `ui.components.Select` | 11 | 11/11 | 3 | 4 | 1 | 6 |   9.0 |   3.0 |   4.0 (r74) | 0 in 0 changed | 7 | 0 | 1.07M | $3.26 | `audit78-ui.components.Select`, landed early at c558c217f3 |
| `ui.components.Timeline` | 18 | 18/18 | 5 | 4 | 1 | 8 |  14.0 |   6.0 |  20.0 (r77) | 0 in 0 changed | 9 | 0 | 1.78M | $5.28 | `audit78-ui.components.Timeline`, landed early at c558c217f3 |

Totals: 118 distinct findings, 126 fix commits, 0 questions, 26.57M weighted tokens, $81.90.

## Control sweep

The control sweep off (it runs only with --sweep).
