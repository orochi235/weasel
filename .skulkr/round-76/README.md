# Audit round 76

Blind pairs at `8d4af58eba06794393ff861c9fe8762fdda45f72` (2026-11-22), run by skulkr. Each area's directory holds its file
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
| `apps.theme-editor.src` | 50 | 50/50 | 5 | 5 | 0 | 10 |  35.0 |  25.0 |   6.0 (r75) | 0 in 0 changed | 10 | 0 | 2.18M | $6.10 | `audit76-apps.theme-editor.src`, landed early at c3573606f5 |
| `diagram.avoid` | 25 | 25/25 | 7 | 5 | 3 | 9 |  11.0 |   2.0 |   1.7 (r46) | 0 in 0 changed | 9 | 0 | 1.81M | $5.19 | `audit76-diagram.avoid`, landed early at c3573606f5 |
| `font.outline` | 15 | 15/15 | 6 | 5 | 2 | 9 |  13.0 |   4.0 |   1.5 (r47) | 0 in 0 changed | 9 | 0 | 1.22M | $3.70 | `audit76-font.outline`, landed early at c3573606f5 |
| `forge.vite` | 50 | 50/50 | 5 | 6 | 1 | 10 |  20.0 |  10.0 |   4.0 (r48) | 0 in 0 changed | 12 | 0 | 1.98M | $5.76 | `audit76-forge.vite` |
| `gestures` | 43 | 43/43 | 5 | 6 | 3 | 8 |   9.5 |   1.5 |   4.0 (r49) | 0 in 0 changed | 7 | 0 | 1.15M | $3.80 | `audit76-gestures`, landed early at c3573606f5 |
| `p-touch` | 10 | 10/10 | 2 | 1 | 1 | 2 |   2.0 |   0.0 |   4.0 (r69) | 0 in 0 changed | 2 | 0 | 1.09M | $3.22 | `audit76-p-touch`, landed early at c3573606f5 |
| `prefs-schema` | 31 | 31/31 | 5 | 4 | 0 | 9 |  29.0 |  20.0 |   4.0 (r70) | 0 in 0 changed | 8 | 0 | 0.66M | $4.78 | `audit76-prefs-schema` |
| `text-dom` | 36 | 36/36 | 2 | 3 | 0 | 5 |  11.0 |   6.0 |   7.5 (r75) | 0 in 0 changed | 5 | 0 | 1.41M | $4.58 | `audit76-text-dom`, landed early at c3573606f5 |

Totals: 62 distinct findings, 62 fix commits, 0 questions, 11.50M weighted tokens, $37.13.

## Control sweep

The control sweep off (it runs only with --sweep).
