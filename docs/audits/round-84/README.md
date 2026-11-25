# Audit round 84

Blind pairs at `c3507b2b3df7fe1c7423033bbe868d5f0ce4fbea` (2026-11-24), run by skulkr. Each area's directory holds its file
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
| `editing.actions` | 35 | 35/35 | 4 | 4 | 1 | 7 |  11.5 |   4.5 |   8.0 (r83) | 0 in 0 changed | 6 | 0 | 1.16M | $3.60 | $0.103 | `audit84-editing.actions` |
| `editing.actions.move` | 33 | 33/33 | 3 | 2 | 0 | 5 |  11.0 |   6.0 |  12.0 (r83) | 0 in 0 changed | 5 | 1 | 1.50M | $4.60 | $0.139 | `audit84-editing.actions.move` |
| `forge.vite.part1` | 27 | 27/27 | 3 | 7 | 1 | 9 |  15.0 |   6.0 |   5.0 (r83) | 0 in 0 changed | 8 | 0 | 1.44M | $4.62 | $0.171 | `audit84-forge.vite.part1` |
| `geom.booleans` | 32 | 32/32 | 2 | 2 | 1 | 3 |   3.5 |   0.5 |   9.0 (r83) | 0 in 0 changed | 2 | 0 | 1.09M | $3.76 | $0.117 | `audit84-geom.booleans` |
| `history` | 17 | 17/17 | 3 | 5 | 2 | 6 |   7.0 |   1.0 |   5.0 (r83) | 0 in 0 changed | 7 | 0 | 1.68M | $5.15 | $0.303 | `audit84-history` |
| `renderer.gpu` | 16 | 16/16 | 3 | 3 | 2 | 4 |   4.3 |   0.3 |   3.1 (r71) | 0 in 1 changed | 4 | 0 | 0.82M | $2.56 | $0.160 | `audit84-renderer.gpu` |
| `routing` | 35 | 35/35 | 4 | 4 | 2 | 6 |   7.3 |   1.3 |   1.0 (r54) | 3 in 2 changed | 6 | 0 | 0.77M | $4.46 | $0.127 | `audit84-routing` |
| `ui.components.ToolbarDock` | 12 | 12/12 | 9 | 9 | 6 | 12 |  13.3 |   1.3 |   3.3 (r59) | 2 in 1 changed | 12 | 0 | 1.23M | $3.74 | $0.312 | `audit84-ui.components.ToolbarDock` |

Totals: 52 distinct findings, 50 fix commits, 1 questions, 9.69M weighted tokens, $32.49 ($4.06 per area, $0.157 per file).

## Control sweep

The control sweep off (it runs only with --sweep).
