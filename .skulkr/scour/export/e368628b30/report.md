# export: saturation

Repeated blind reviews of the area `export` (12 files) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, or 40 occasions have run.
Not stopped yet. `skulkr saturate report export` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.17 |    $0.06 |     0.2 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        3 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        3 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                           | where                                                   | first | codex | severity |
|-----|----------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------|------:|------:|----------|
| D1  | selectionRegion ignores consuming ancestors, so a consumed (never drawn) child yields a selection export region                  | packages/export/src/selectionRegion.ts:50               |     1 |     1 | medium   |
| D2  | A selected parent's drawn bounds include annotation-layer descendants that export excludes, enlarging the crop                   | packages/export/src/selectionRegion.ts:29 (drawnAabbOf) |     1 |     1 | medium   |
| D3  | Strict PNG export validates the warmup plan's diagnostics, not the final plan's, so losses introduced after warmup go unreported | packages/export/src/regionPng.ts:25 (capturePngRegion)  |     1 |     1 | medium   |
