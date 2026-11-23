# Audit round 74

Blind pairs at `eb825dfd75133fc3ebe9452e9de8157d96ee73d3` (2026-11-22), run by skulkr. Each area's directory holds its file
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
| `audio` | 47 | 47/47 | 5 | 6 | 2 | 9 |  13.0 |   4.0 |  10.0 (r73) | 0 in 0 changed | 9 | 0 | 1.78M | $5.51 | `audit74-audio`, landed early at 7e71443d50 |
| `core.core.scene.part2` | 40 | 40/40 | 3 | 3 | 1 | 5 |   7.0 |   2.0 |   3.9 (r66) | 1 in 6 changed | 7 | 0 | 1.45M | $4.34 | `audit74-core.core.scene.part2`, landed early at 7e71443d50 |
| `diagram-formats.mermaid.part1` | 35 | 35/35 | 10 | 3 | 1 | 12 |  21.0 |   9.0 |  24.0 (r73) | 0 in 0 changed | 12 | 0 | 1.87M | $5.85 | `audit74-diagram-formats.mermaid.part1`, landed early at 7e71443d50 |
| `diagram.effect.part1` | 31 | 31/31 | 2 | 2 | 0 | 4 |   8.0 |   4.0 |   8.0 (r73) | 0 in 0 changed | 5 | 0 | 1.23M | $3.80 | `audit74-diagram.effect.part1`, landed early at 7e71443d50 |
| `labkit.part1` | 32 | 32/32 | 1 | 2 | 1 | 2 |   2.0 |   0.0 |   4.8 (r73) | 0 in 0 changed | 2 | 2 | 0.84M | $2.55 | `audit74-labkit.part1`, landed early at 7e71443d50 |
| `text-dom` | 35 | 35/35 | 4 | 3 | 0 | 7 |  19.0 |  12.0 |   4.0 (r55) | 2 in 7 changed | 5 | 0 | 2.04M | $5.91 | `audit74-text-dom` |
| `ui.components.Select` | 10 | 10/10 | 5 | 3 | 1 | 7 |  11.0 |   4.0 |   4.0 (r59) | 3 in 1 changed | 8 | 0 | 1.15M | $3.38 | `audit74-ui.components.Select` |
| `ui.components.part2` | 46 | 46/46 | 4 | 3 | 1 | 6 |   9.0 |   3.0 |   8.0 (r73) | 0 in 0 changed | 5 | 0 | 1.25M | $3.82 | `audit74-ui.components.part2`, landed early at 7e71443d50 |

Totals: 52 distinct findings, 53 fix commits, 2 questions, 11.61M weighted tokens, $35.16.

## Control sweep

The control sweep off (it runs only with --sweep).
