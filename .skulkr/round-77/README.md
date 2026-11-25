# Audit round 77

Blind pairs at `9081ff60eaadbfc5530490c9f0f077c44c65945d` (2026-11-23), run by skulkr. Each area's directory holds its file
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
| `apps.theme-editor.src` | 50 | 50/50 | 4 | 4 | 1 | 7 |  11.5 |   4.5 |  25.0 (r76) | 0 in 0 changed | 8 | 0 | 1.67M | $5.06 | `audit77-apps.theme-editor.src`, landed early at 30c325a38d |
| `devtools.views` | 40 | 40/40 | 3 | 2 | 0 | 5 |  11.0 |   6.0 |   4.0 (r71) | 0 in 0 changed | 4 | 0 | 0.84M | $2.59 | `audit77-devtools.views`, landed early at 30c325a38d |
| `diagram.avoid` | 25 | 25/25 | 5 | 1 | 1 | 5 |   5.0 |   0.0 |   2.0 (r76) | 0 in 0 changed | 5 | 0 | 0.78M | $5.00 | `audit77-diagram.avoid`, landed early at 30c325a38d |
| `forge.vite` | 50 | 50/50 | 5 | 5 | 1 | 9 |  17.0 |   8.0 |  10.0 (r76) | 0 in 0 changed | 10 | 0 | 1.93M | $5.77 | `audit77-forge.vite`, landed early at 30c325a38d |
| `paint` | 32 | 32/32 | 2 | 4 | 1 | 5 |   6.5 |   1.5 |   1.6 (r72) | 0 in 0 changed | 6 | 0 | 1.30M | $3.99 | `audit77-paint` |
| `prefs-schema` | 31 | 31/31 | 5 | 2 | 0 | 7 |  17.0 |  10.0 |  20.0 (r76) | 0 in 0 changed | 6 | 0 | 1.42M | $4.45 | `audit77-prefs-schema`, landed early at 30c325a38d |
| `text-dom` | 36 | 36/36 | 1 | 5 | 0 | 6 |  11.0 |   5.0 |   6.0 (r76) | 0 in 0 changed | 9 | 0 | 1.82M | $5.63 | `audit77-text-dom` |
| `ui.components.Timeline` | 18 | 18/18 | 4 | 5 | 0 | 9 |  29.0 |  20.0 |   1.5 (r70) | 0 in 0 changed | 10 | 0 | 1.61M | $4.67 | `audit77-ui.components.Timeline`, landed early at 30c325a38d |

Totals: 53 distinct findings, 58 fix commits, 0 questions, 11.37M weighted tokens, $37.16.

## Control sweep

The control sweep off (it runs only with --sweep).
