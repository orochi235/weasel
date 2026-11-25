# Audit round 73

Blind pairs at `3b7040612f5f1a5a66fb140cc019f4a90fffe831` (2026-11-22), run by skulkr. Each area's directory holds its file
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
| `audio` | 47 | 47/47 | 11 | 3 | 1 | 13 |  23.0 |  10.0 |   1.4 (r38) | 10 in 17 changed | 17 | 0 | 2.68M | $7.57 | `audit73-audio` |
| `diagram-formats.mermaid.part1` | 35 | 35/35 | 9 | 7 | 1 | 15 |  39.0 |  24.0 |  20.3 (r72) | 0 in 0 changed | 15 | 0 | 2.17M | $6.47 | `audit73-diagram-formats.mermaid.part1` |
| `diagram.effect.part1` | 31 | 31/31 | 2 | 4 | 0 | 6 |  14.0 |   8.0 |  17.5 (r72) | 0 in 0 changed | 7 | 0 | 0.75M | $5.76 | `audit73-diagram.effect.part1` |
| `forge.shell.loupe` | 19 | 19/19 | 5 | 4 | 3 | 6 |   6.5 |   0.5 |   1.5 (r48) | 2 in 6 changed | 6 | 0 | 0.95M | $2.90 | `audit73-forge.shell.loupe` |
| `hud.widgets` | 18 | 18/18 | 5 | 5 | 4 | 6 |   6.2 |   0.2 |   1.5 (r50) | 4 in 5 changed | 7 | 0 | 1.25M | $3.46 | `audit73-hud.widgets` |
| `labkit.part1` | 33 | 33/33 | 7 | 5 | 2 | 10 |  15.0 |   5.0 |   1.5 (r50) | 9 in 9 changed | 9 | 1 | 1.84M | $5.16 | `audit73-labkit.part1` |
| `theme.engine` | 29 | 29/29 | 4 | 3 | 1 | 6 |   9.0 |   3.0 |   8.0 (r72) | 0 in 0 changed | 5 | 0 | 1.49M | $4.73 | `audit73-theme.engine` |
| `ui.components.part2` | 46 | 46/46 | 4 | 2 | 0 | 6 |  14.0 |   8.0 |   1.5 (r60) | 1 in 5 changed | 6 | 0 | 0.89M | $2.79 | `audit73-ui.components.part2` |

Totals: 68 distinct findings, 72 fix commits, 1 questions, 12.02M weighted tokens, $38.84.

## Control sweep

The control sweep off (it runs only with --sweep).
