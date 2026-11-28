# geom.warp: saturation

Repeated blind reviews of the area `geom.warp` (18 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report geom.warp` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.17 |    $0.06 |     0.1 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        3 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        3 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                                | where                                            | first | codex | severity |
|-----|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------|------:|------:|----------|
| D1  | Adaptive warp sampling can miss a localized bend between samples, returning a fit that deviates by many times the requested tolerance                                                 | packages/geom/src/warp/warpPath.ts:89            |     1 |     1 | medium   |
| D2  | A non-finite cloth dimension (NaN or Infinity) yields an empty grid with NaN rows or an unbounded point-generation loop                                                               | packages/geom/src/warp/mesh.ts:29 (meshGridOver) |     1 |     1 | medium   |
| D3  | Pin-map inversion's finite-difference step scales with the largest coordinate, so a large x offset inflates the y derivative and inversion fails to converge within the iteration cap | packages/geom/src/warp/pinWarp.ts:145            |     1 |     1 | medium   |
