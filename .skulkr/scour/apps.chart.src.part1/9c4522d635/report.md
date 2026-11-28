# apps.chart.src.part1: saturation

Repeated blind reviews of the area `apps.chart.src.part1` (28 files, 1481 lines) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: fewer than 1 defect per thousand lines estimated unseen (0.00). No new defect is expected. `skulkr scour report apps.chart.src.part1` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        1 |   1 |        1 |   1 |   0 |          – |      – |        – | $0.17 |    $0.17 |     0.1 |
|   2 | claude |        1 |   0 |        1 |   0 |   1 |        1.0 |    0.0 |     0.0% | $1.75 |    $1.92 |     3.0 |
|   3 | claude |        0 |   0 |        1 |   0 |   1 |        1.0 |    0.0 |     0.0% | $0.96 |    $2.87 |     2.6 |
|   4 | claude |        0 |   0 |        1 |   0 |   1 |        1.0 |    0.0 |     0.0% | $1.13 |    $4.00 |     3.1 |
|   5 | claude |        0 |   0 |        1 |   0 |   1 |        1.0 |    0.0 |     0.0% | $0.50 |    $4.51 |     1.9 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        1 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |        1 |        1.0 |    0.0 |   100.0% |       – |
| all sources    | Chao2     |         5 |        1 |        1.0 |    0.0 |     0.0% |       – |
| codex × claude | Chapman   |         – |        1 |        1.0 |    0.0 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                 | where                                 | first | codex | claude | severity |
|-----|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------|------:|------:|-------:|----------|
| D1  | File Open fails on a saved document containing a locked group with children because replacement adds the locked group first and the add path refuses children under it | apps/chart/src/chartPersistence.ts:75 |     1 |     1 |      1 | medium   |
