# svg.part1: saturation

Repeated blind reviews of the area `svg.part1` (39 files, 3989 lines) at the frozen commit
`568f19b0a5`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report svg.part1` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.23 |    $0.08 |     0.2 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        3 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        3 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                     | where                                | first | codex | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------|------:|------:|----------|
| D1  | Opacity on the outer SVG element is dropped on import; no opacity group is made for the root as one is for a nested svg                    | packages/svg/src/parse.ts:107        |     1 |     1 | medium   |
| D2  | Hidden-text precheck inspects only immediate tspans, so a visible grandchild tspan is dropped with the whole text                          | packages/svg/src/hiddenElement.ts:17 |     1 |     1 | medium   |
| D3  | Length reader falls back to parseFloat on a malformed length, accepting its numeric prefix and bypassing the fallback and unit diagnostics | packages/svg/src/lengths.ts:101      |     1 |     1 | low      |
