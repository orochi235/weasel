# renderer.draw: saturation

Repeated blind reviews of the area `renderer.draw` (35 files, 5152 lines) at the frozen commit
`0269be874a`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: fewer than 1 defect per thousand lines estimated unseen (0.70). The next defect should cost about $3.37. `skulkr scour report renderer.draw` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.17 |    $0.09 |     0.2 |
|   2 | claude |        2 |   2 |        4 |   4 |   0 |        7.0 |    3.0 |   100.0% | $2.05 |    $0.56 |     4.2 |
|   3 | claude |        2 |   0 |        4 |   2 |   2 |        4.7 |    0.7 |    16.7% | $1.51 |    $0.93 |     5.1 |
|   4 | claude |        1 |   0 |        4 |   2 |   1 |        5.5 |    1.5 |    21.4% | $3.22 |    $1.74 |     7.2 |
|   5 | claude |        2 |   1 |        5 |   3 |   1 |        8.6 |    3.6 |    28.6% | $1.13 |    $1.62 |     3.9 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |        3 |        3.4 |    0.4 |     8.6% |       – |
| all sources    | Chao2     |         5 |        5 |        8.6 |    3.6 |    28.6% |       – |
| codex × claude | Chapman   |         – |        5 |       11.0 |    6.0 |        – |       0 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                         | where                                                                                                                        | first | codex | claude | severity |
|-----|------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Batch and direct linear-gradient math disagree for lengths below 0.0001, so short gradients change appearance between batched and direct draws | packages/renderer/src/draw/gradient.ts:93                                                                                    |     1 |     1 |      0 | medium   |
| D2  | Renderer disposal never deletes the cached quad VAOs (no deleteGeometry call), leaking them on a context that outlives the renderer            | packages/renderer/src/draw/quad.ts:23                                                                                        |     1 |     1 |      0 | low      |
| D3  | A clip's stencil pop is flattened at a different tolerance than its push, leaving stale clip bits                                              | packages/renderer/src/draw/clip.ts:239 (rasterizePathToStencil)                                                              |     2 |     0 |      4 | medium   |
| D4  | drawGroupWithEffects and drawInto leave the context redirected if a child throws                                                               | packages/renderer/src/draw/groupEffects.ts:113 (drawGroupWithEffects); packages/renderer/src/draw/retained.ts:151 (drawInto) |     2 |     0 |      2 | low      |
| D5  | A retained group nested in an effects buffer inside another retained group's tile reuses the scratch buffer that tile is still drawing into    | packages/renderer/src/draw/retained.ts:61 (drawRetainedGroup)                                                                |     5 |     0 |      1 | medium   |
