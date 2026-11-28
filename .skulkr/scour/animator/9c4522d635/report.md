# animator: saturation

Repeated blind reviews of the area `animator` (34 files, 4153 lines) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: fewer than 1 defect per thousand lines estimated unseen (0.60). The next defect should cost about $1.93. `skulkr scour report animator` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.17 |    $0.09 |     0.1 |
|   2 | claude |        3 |   2 |        4 |   3 |   1 |        6.3 |    2.3 |    36.0% | $1.66 |    $0.46 |     3.1 |
|   3 | claude |        4 |   3 |        7 |   5 |   2 |       11.2 |    4.2 |    39.7% | $0.71 |    $0.36 |     2.7 |
|   4 | claude |        4 |   1 |        8 |   4 |   3 |       10.0 |    2.0 |    20.5% | $2.39 |    $0.62 |     5.3 |
|   5 | claude |        6 |   3 |       11 |   5 |   4 |       13.5 |    2.5 |    17.9% | $1.50 |    $0.58 |     3.2 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |       11 |       15.5 |    4.5 |    25.0% |       – |
| all sources    | Chao2     |         5 |       11 |       13.5 |    2.5 |    17.9% |       – |
| codex × claude | Chapman   |         – |       11 |       11.0 |    0.0 |        – |       2 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                                            | where                                                                                                                                  | first | codex | claude | severity |
|-----|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | A disposed hosted animator still accepts new tweens that report active but never advance, and repeated dispose() leaves them active                                                               | packages/animator/src/createHostedAnimator.ts:51                                                                                       |     1 |     1 |      3 | medium   |
| D2  | A NaN joint-weight edit propagates through clamping and normalization and drops all influence on the point, leaving an empty skin                                                                 | packages/animator/src/rig/weightEdits.ts:21 (setJointWeights)                                                                          |     1 |     1 |      1 | medium   |
| D3  | toSkinPolygon stores a rect's corners as absolute Float32 coordinates with no origin, so precision is lost far from the origin                                                                    | packages/animator/src/rig/skin.ts:40 (toSkinPolygon)                                                                                   |     2 |     0 |      2 | medium   |
| D4  | tweenVertexColors and staggerVertexColors read the caller's live from/to arrays every frame but commit a copy taken at start, so mid-tween mutations show during the tween and are lost at commit | packages/animator/src/colorHelpers.ts:93 (tweenVertexColors), packages/animator/src/colorHelpers.ts:181 (staggerVertexColors colorsAt) |     2 |     0 |      2 | low      |
| D5  | A loop pass whose child finishes synchronously leaves `current` pointing at the stale child                                                                                                       | packages/animator/src/loop.ts:83 (createLoop / next)                                                                                   |     3 |     0 |      1 | low      |
| D6  | A stagger child that has already finished is counted done before it is added, and is still kept as a live child                                                                                   | packages/animator/src/stagger.ts:262 (runStagger fire)                                                                                 |     3 |     0 |      2 | low      |
| D7  | Skeleton transforms are resolved in Float32, so a rig far from the origin loses precision                                                                                                         | packages/animator/src/rig/resolveSkeleton.ts:20 (toMat3)                                                                               |     3 |     0 |      3 | medium   |
| D8  | A loop whose pass ends without calling onDone stays registered forever, keeping isActive true and the frame loop running                                                                          | packages/animator/src/loop.ts:73 (createLoop next), packages/animator/src/loop.ts:124 (createTweenLoop factory)                        |     4 |     0 |      1 | medium   |
| D9  | skinPath writes its output relative to the rest path's origin, so a rect or a polygon with no origin far from the origin loses precision in the skinned result                                    | packages/animator/src/rig/skin.ts:80 (skinPath)                                                                                        |     5 |     0 |      1 | low      |
| D10 | An animation started from a cancel callback during useAnimator's unmount cleanup stays registered forever                                                                                         | packages/animator/src/useAnimator.ts:113 (unmount cleanup)                                                                             |     5 |     0 |      1 | low      |
| D11 | axisIndexes returns an axis twice when both a name and its path prefix are listed, so a hold counts that axis twice                                                                               | packages/animator/src/axisNames.ts:44 (axisIndexes)                                                                                    |     5 |     0 |      1 | low      |
