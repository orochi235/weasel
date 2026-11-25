# Audit round 75

Blind pairs at `94bb15eaa1e3568dfb48ece30faf4f05fa5cef82` (2026-11-22), run by skulkr. Each area's directory holds its file
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
| `apps.draw.src.surfaces` | 16 | 16/16 | 2 | 0 | 0 | 2 |   2.0 |   0.0 |   4.0 (r35) | 0 in 2 changed | 2 | 0 | 0.55M | $1.79 | `audit75-apps.draw.src.surfaces`, landed early at 1211617354 |
| `apps.theme-editor.src` | 50 | 50/50 | 5 | 8 | 2 | 11 |  17.0 |   6.0 |   4.0 (r40) | 4 in 3 changed | 11 | 0 | 2.13M | $6.02 | `audit75-apps.theme-editor.src` |
| `apps.ui-lab` | 28 | 28/28 | 2 | 2 | 1 | 3 |   3.5 |   0.5 |   1.8 (r36) | 0 in 3 changed | 3 | 0 | 0.92M | $2.79 | `audit75-apps.ui-lab`, landed early at 1211617354 |
| `core.core.viewport` | 23 | 23/23 | 3 | 2 | 2 | 3 |   3.0 |   0.0 |   4.0 (r41) | 0 in 1 changed | 3 | 0 | 0.39M | $2.18 | `audit75-core.core.viewport` |
| `diagram-formats.mermaid.part1` | 35 | 35/35 | 3 | 2 | 1 | 4 |   5.0 |   1.0 |   9.0 (r74) | 0 in 0 changed | 6 | 0 | 1.52M | $5.04 | `audit75-diagram-formats.mermaid.part1`, landed early at 1211617354 |
| `diagram.theme` | 10 | 10/10 | 6 | 7 | 6 | 7 |   7.0 |   0.0 |   4.0 (r64) | 6 in 1 changed | 8 | 0 | 1.08M | $3.17 | `audit75-diagram.theme`, landed early at 1211617354 |
| `hud.loupe` | 16 | 16/16 | 5 | 4 | 2 | 7 |   9.0 |   2.0 |   0.6 (r49) | 8 in 11 changed | 8 | 0 | 1.07M | $3.20 | `audit75-hud.loupe` |
| `text-dom` | 36 | 36/36 | 4 | 6 | 1 | 9 |  16.5 |   7.5 |  12.0 (r74) | 0 in 0 changed | 10 | 0 | 2.08M | $6.22 | `audit75-text-dom` |

Totals: 46 distinct findings, 51 fix commits, 0 questions, 9.74M weighted tokens, $30.41.

## Control sweep

The control sweep off (it runs only with --sweep).
