# core.core.geometry: saturation

Repeated blind reviews of the area `core.core.geometry` (12 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, or 40 occasions have run.
Not stopped yet. `skulkr saturate report core.core.geometry` rewrites this file from the ledger.

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

| id  | defect                                                                                                                  | where                                                                       | first | codex | severity |
|-----|-------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|------:|------:|----------|
| D1  | An explicit descriptor rotation of zero leaves the bounds' old rotation in effect for visual bounds and frame consumers | packages/core/src/core/geometry/poseDescriptor.ts:265                       |     1 |     1 | medium   |
| D2  | Coarse box >= check rejects exact boundary contact before outline intersection is tested in intersect mode              | packages/core/src/core/geometry/regionHit.ts:121                            |     1 |     1 | low      |
| D3  | Union of two finite boxes overflows to an infinite extent in the final width subtraction                                | packages/core/src/core/geometry/unionBounds.ts:127 (unionBounds, unionAabb) |     1 |     1 | low      |
