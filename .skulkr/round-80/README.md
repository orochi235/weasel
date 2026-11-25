# Audit round 80

Blind pairs at `26d31298a400369a84adda3ade6a920490bec2b6` (2026-11-23), run by skulkr. Each area's directory holds its file
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
| `apps.draw.src.part1` | 38 | 38/38 | 2 | 1 | 0 | 3 |   5.0 |   2.0 |  12.0 (r79) | 0 in 0 changed | 3 | 0 | 1.03M | $3.14 | $0.083 | `audit80-apps.draw.src.part1` |
| `apps.theme-editor.src` | 50 | 50/50 | 1 | 3 | 0 | 4 |   7.0 |   3.0 |  12.0 (r79) | 0 in 0 changed | 4 | 0 | 1.50M | $4.81 | $0.096 | `audit80-apps.theme-editor.src` |
| `audio` | 47 | 47/47 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |  18.0 (r79) | 0 in 0 changed | 5 | 0 | 1.63M | $5.36 | $0.114 | `audit80-audio` |
| `font.outline` | 15 | 15/15 | 2 | 1 | 0 | 3 |   5.0 |   2.0 |   6.0 (r79) | 0 in 0 changed | 4 | 0 | 1.15M | $3.71 | $0.247 | `audit80-font.outline` |
| `forge.vite.part1` | 26 | 26/26 | 6 | 7 | 1 | 12 |  27.0 |  15.0 |   7.5 (r79) | 0 in 0 changed | 12 | 0 | 1.98M | $5.63 | $0.217 | `audit80-forge.vite.part1` |
| `forge.vite.part2` | 25 | 25/25 | 6 | 5 | 2 | 9 |  13.0 |   4.0 |   7.5 (r79) | 0 in 0 changed | 8 | 0 | 0.61M | $4.47 | $0.179 | `audit80-forge.vite.part2`, merged by hand after a conflict in packages/forge/src/vite/apiTable.test.ts |
| `loupe` | 11 | 11/11 | 5 | 3 | 2 | 6 |   7.0 |   1.0 |   7.0 (r79) | 0 in 0 changed | 5 | 0 | 0.91M | $2.75 | $0.250 | `audit80-loupe` |
| `renderer.part2` | 38 | 38/38 | 4 | 4 | 1 | 7 |  11.5 |   4.5 |   4.0 (r79) | 0 in 0 changed | 6 | 0 | 1.31M | $3.83 | $0.101 | `audit80-renderer.part2` |

Totals: 49 distinct findings, 47 fix commits, 0 questions, 10.12M weighted tokens, $33.70 ($4.21 per area, $0.135 per file).

## Control sweep

The control sweep off (it runs only with --sweep).
