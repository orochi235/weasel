# core.core.layers: saturation

Repeated blind reviews of the area `core.core.layers` (13 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, or 40 occasions have run.
Not stopped yet. `skulkr saturate report core.core.layers` rewrites this file from the ledger.

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

| id  | defect                                                                                                                                | where                                            | first | codex | severity |
|-----|---------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------|------:|------:|----------|
| D1  | Hiding a gated tiled layer without its own deps leaves cached tiles visible while hit testing is disabled                             | packages/core/src/core/layers/gateLayer.ts:20    |     1 |     1 | medium   |
| D2  | Tile host keeps its original pyramid with stale maxLevel/fadeMs/bounds after a layer update with the same id and tile size            | packages/core/src/core/layers/tileHost.ts:88     |     1 |     1 | medium   |
| D3  | Composed redraw source leaks earlier listeners when a later subscribe throws, and skips later unsubscribes when an earlier one throws | packages/core/src/core/layers/redrawSource.ts:14 |     1 |     1 | low      |
