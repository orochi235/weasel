# export: saturation

Repeated blind reviews of the area `export` (12 files, 628 lines) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 11.1 known defects per thousand lines, at least 5. The next defect should cost about $0.64. `skulkr scour report export` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.17 |    $0.06 |     0.2 |
|   2 | claude |        3 |   2 |        5 |   4 |   1 |        9.0 |    4.0 |    44.4% | $0.96 |    $0.23 |     1.2 |
|   3 | claude |        1 |   1 |        6 |   5 |   1 |       14.3 |    8.3 |    59.5% | $0.55 |    $0.28 |     1.1 |
|   4 | claude |        2 |   1 |        7 |   5 |   2 |       11.7 |    4.7 |    43.9% | $0.43 |    $0.30 |     0.8 |
|   5 | claude |        0 |   0 |        7 |   5 |   2 |       12.0 |    5.0 |    46.3% | $0.38 |    $0.36 |     1.0 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        3 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |        5 |       11.0 |    6.0 |    57.1% |       – |
| all sources    | Chao2     |         5 |        7 |       12.0 |    5.0 |    46.3% |       – |
| codex × claude | Chapman   |         – |        7 |       11.0 |    4.0 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                 | where                                                       | first | codex | claude | severity |
|-----|----------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | selectionRegion ignores consuming ancestors, so a consumed (never drawn) child yields a selection export region                        | packages/export/src/selectionRegion.ts:50                   |     1 |     1 |      1 | medium   |
| D2  | A selected parent's drawn bounds include annotation-layer descendants that export excludes, enlarging the crop                         | packages/export/src/selectionRegion.ts:29 (drawnAabbOf)     |     1 |     1 |      0 | medium   |
| D3  | Strict PNG export validates the warmup plan's diagnostics, not the final plan's, so losses introduced after warmup go unreported       | packages/export/src/regionPng.ts:25 (capturePngRegion)      |     1 |     1 |      0 | medium   |
| D4  | selectionRegion omits the copies a selected container draws via copiesFromPose, so the exported crop cuts them off                     | packages/export/src/selectionRegion.ts:35 (selectionRegion) |     2 |     0 |      1 | medium   |
| D5  | shownIds recurses into children of a consumesChildren node on a hidden or annotation layer, counting ones the render walk never paints | packages/export/src/selectionRegion.ts:51 (shownIds)        |     2 |     0 |      1 | low      |
| D6  | selectionRegion treats a zero-width or zero-height region as drawing something, so the PNG export then refuses it                      | packages/export/src/selectionRegion.ts:38 (selectionRegion) |     3 |     0 |      2 | low      |
| D7  | Dev 'unread option' warning is suppressed for an override of the same format id that reads different options                           | packages/export/src/exportFormats.ts:89 (warnUnreadOptions) |     4 |     0 |      1 | low      |
