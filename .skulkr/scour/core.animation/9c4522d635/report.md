# core.animation: saturation

Repeated blind reviews of the area `core.animation` (26 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: the next occasion's chance of a new finding is under 15% (14.7%). The next defect should cost about $2.85. `skulkr scour report core.animation` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        4 |   4 |        4 |   4 |   0 |          – |      – |        – | $0.17 |    $0.04 |     0.4 |
|   2 | claude |        5 |   4 |        8 |   7 |   1 |       20.3 |   12.3 |    60.5% | $1.12 |    $0.16 |     3.0 |
|   3 | claude |        5 |   4 |       12 |  10 |   2 |       28.7 |   16.7 |    59.5% | $1.12 |    $0.20 |     3.0 |
|   4 | claude |        1 |   0 |       12 |   9 |   3 |       22.1 |   10.1 |    49.1% | $1.31 |    $0.31 |     3.7 |
|   5 | claude |        3 |   1 |       13 |   9 |   3 |       23.8 |   10.8 |    42.9% | $0.56 |    $0.33 |     2.2 |
|   6 | claude |        2 |   1 |       14 |  10 |   3 |       27.9 |   13.9 |    44.6% | $1.39 |    $0.40 |     6.2 |
|   7 | claude |        2 |   0 |       14 |   9 |   4 |       22.7 |    8.7 |    35.6% | $1.14 |    $0.49 |     4.0 |
|   8 | claude |        3 |   1 |       15 |   9 |   5 |       22.1 |    7.1 |    31.1% | $1.07 |    $0.52 |     4.5 |
|   9 | claude |        2 |   0 |       15 |   9 |   4 |       24.0 |    9.0 |    30.0% | $0.72 |    $0.57 |     2.9 |
|  10 | claude |        3 |   2 |       17 |  11 |   4 |       30.6 |   13.6 |    33.9% | $0.72 |    $0.55 |     3.2 |
|  11 | claude |        2 |   1 |       18 |  12 |   4 |       34.4 |   16.4 |    35.2% | $0.80 |    $0.56 |     3.4 |
|  12 | claude |        1 |   0 |       18 |  12 |   4 |       34.5 |   16.5 |    34.3% | $0.88 |    $0.61 |     6.9 |
|  13 | claude |        1 |   1 |       19 |  13 |   4 |       38.5 |   19.5 |    36.4% | $1.09 |    $0.64 |     5.1 |
|  14 | claude |        3 |   0 |       19 |  11 |   6 |       28.4 |    9.4 |    27.4% | $1.02 |    $0.69 |     2.6 |
|  15 | claude |        2 |   0 |       19 |  11 |   6 |       28.4 |    9.4 |    26.2% | $1.01 |    $0.74 |     3.7 |
|  16 | claude |        3 |   1 |       20 |  12 |   6 |       31.3 |   11.3 |    26.8% | $1.17 |    $0.76 |     3.5 |
|  17 | claude |        1 |   0 |       20 |  12 |   6 |       31.3 |   11.3 |    26.3% | $0.80 |    $0.80 |     2.3 |
|  18 | claude |        4 |   1 |       21 |  12 |   7 |       30.7 |    9.7 |    23.9% | $0.97 |    $0.81 |     2.8 |
|  19 | claude |        2 |   1 |       22 |  13 |   7 |       33.4 |   11.4 |    25.0% | $0.92 |    $0.82 |     3.6 |
|  20 | claude |        2 |   0 |       22 |  13 |   6 |       35.4 |   13.4 |    24.3% | $1.01 |    $0.86 |     6.7 |
|  21 | claude |        3 |   0 |       22 |  12 |   6 |       33.4 |   11.4 |    21.2% | $0.90 |    $0.90 |     3.7 |
|  22 | claude |        4 |   0 |       22 |  12 |   4 |       39.2 |   17.2 |    20.1% | $1.08 |    $0.95 |     3.0 |
|  23 | claude |        2 |   0 |       22 |  12 |   4 |       39.2 |   17.2 |    19.4% | $1.05 |    $1.00 |     2.8 |
|  24 | claude |        5 |   0 |       22 |  10 |   5 |       31.6 |    9.6 |    14.7% | $1.26 |    $1.06 |     4.3 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        4 |          – |      – |        – |       – |
| claude         | Chao2     |        23 |       19 |       26.7 |    7.7 |    12.5% |       – |
| all sources    | Chao2     |        24 |       22 |       31.6 |    9.6 |    14.7% |       – |
| codex × claude | Chapman   |         – |       22 |       49.0 |   27.0 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                               | where                                                                                                                                      | first | codex | claude | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | A rejected tween (e.g. ms NaN) still writes and records its destination pose, because the transform is recorded before the animator validates and throws                             | packages/core/src/animation/poseHelpers.ts:110 (tweenPose)                                                                                 |     1 |     1 |      0 | medium   |
| D2  | Cancellation from a synchronous tween start listener is missed because the cancel watcher is installed after the tween call returns, stranding the departing node in the leaving map | packages/core/src/animation/wrappers/animateLifecycle.ts:95                                                                                |     1 |     1 |      1 | medium   |
| D3  | Reflow transitions sharing an animator derive tween keys from node ID alone, so disposing one cancels the other's glide for the same ID and leaves a stale override                  | packages/core/src/animation/reflow.ts:49                                                                                                   |     1 |     1 |      0 | medium   |
| D4  | Path motion applies only rotation to the anchor offset, ignoring skew/stretch in the pose's linear transform, so an off-center anchor is displaced from the path                     | packages/core/src/animation/pathMotion.ts:72                                                                                               |     1 |     1 |      0 | medium   |
| D5  | A rotated skinned node is bent and baked with its rotation applied twice                                                                                                             | packages/core/src/animation/rig/skinBinding.ts:82 (bindSkins show) and :94 (write)                                                         |     2 |     0 |      9 | –        |
| D6  | scenePoseTarget's shape check reads the caller's descriptor instead of the one the target was built with                                                                             | packages/core/src/animation/poseTarget.ts:205 (scenePoseTarget)                                                                            |     2 |     0 |      3 | –        |
| D7  | coastByWrite never ends a 'stop' coast early when a dragged id has no release pose                                                                                                   | packages/core/src/animation/behaviors/coastByWrite.ts:72-96 (onTick)                                                                       |     2 |     0 |      3 | –        |
| D8  | useRigNode throws during render for a node under the rig that has a skin but no path                                                                                                 | packages/core/src/animation/rig/rigNode.ts:156-160 (read) → skinBinding.ts:66 (bindSkins)                                                  |     2 |     0 |      1 | –        |
| D9  | coastByWrite never hears an outside cancel of its decay, so the preview stays up, the flick goes unrecorded and the coast stays in `coasts`                                          | packages/core/src/animation/behaviors/coastByWrite.ts:61 (coastByWrite, animator.decay call)                                               |     3 |     0 |     20 | –        |
| D10 | A coast interrupted by springPose records the interrupter's destination as the flick and writes the document back to the drag origin under it                                        | packages/core/src/animation/behaviors/coastOnTargets.ts:162 (watch → halted), :106 (halted), :52 (flickOps)                                |     3 |     0 |      3 | –        |
| D11 | animateOnSetPose and animateLifecycle spread the adapter, dropping every prototype method of a class-based adapter                                                                   | packages/core/src/animation/wrappers/animateOnSetPose.ts:56 and packages/core/src/animation/wrappers/animateLifecycle.ts:46 (`...adapter`) |     3 |     0 |      2 | –        |
| D12 | useRigNode throws during render when its rig node is deleted                                                                                                                         | packages/core/src/animation/rig/rigNode.ts:168 (read), called from useRigNode's useMemo at :222                                            |     3 |     0 |      2 | –        |
| D13 | A node that has dropped out of a multi-node coast still stops the whole coast when dragged again, because the coast keeps the full draggedIds list                                   | packages/core/src/animation/behaviors/momentum.ts:114 (onStart); coastByWrite.ts:43 / coastOnTargets.ts:146 (ids: ctx.draggedIds.slice())  |     5 |     0 |      1 | –        |
| D14 | A Rig rebound on the same seat still writes through its dropped binding from place() and pose(), leaving overrides nothing clears                                                    | packages/core/src/animation/rig/bindRig.ts:228-237 (bindRigOn, rig.pose / rig.place)                                                       |     6 |     0 |      1 | –        |
| D15 | A momentum coast on pose targets runs under its own coastKey rather than `pose:<id>`, so cancelKey/isActive/pauseKey on the node miss the running coast                              | packages/core/src/animation/behaviors/coastOnTargets.ts:93 (cancelKey from coastKey())                                                     |     8 |     0 |      1 | –        |
| D16 | momentum selects pose targets using one descriptor default but coasts them using a different one                                                                                     | packages/core/src/animation/behaviors/momentum.ts:104 (targetsOf) vs :82                                                                   |    10 |     0 |      3 | –        |
| D17 | bindRig rejects a node that is both skinned and bound, but silently accepts the same node bound twice                                                                                | packages/core/src/animation/rig/bindRig.ts:186 (bindRigOn binding loop)                                                                    |    10 |     0 |      2 | –        |
| D18 | useRigNode ignores a change of descriptor, so the skeleton stays placed by the old descriptor                                                                                        | packages/core/src/animation/rig/rigNode.ts:183 (sameRefs) and :216-219 (useRigNode)                                                        |    11 |     0 |      4 | –        |
| D19 | Rig.bake compounds under useRigNode: the bake's write rebinds the rig with the baked poses as rest while the seat keeps the baked skeleton pose, so the bake is applied twice        | packages/core/src/animation/rig/bindRig.ts:236 (bindRigOn → rig.bake), with packages/core/src/animation/rig/rigNode.ts:216 (useRigNode)    |    13 |     0 |      1 | –        |
| D20 | Rig.world() returns rest worlds and ignores the seat's placement until the rig is next shown                                                                                         | packages/core/src/animation/rig/bindRig.ts:180 (bindRigOn: `let world = restWorlds`)                                                       |    16 |     0 |      1 | –        |
| D21 | The coasts' still-ours check compares only unrotated bounds, so a rotation-only write by another writer goes unnoticed and gets overwritten                                          | packages/core/src/animation/behaviors/coastOnTargets.ts:75 (ours), packages/core/src/animation/behaviors/coastByWrite.ts:32 (stillOurs)    |    18 |     0 |      2 | –        |
| D22 | createDepartures drops every leaving ghost mid-fade when the seat's transition object changes                                                                                        | packages/core/src/animation/departures.ts:82 (createDepartures, carrierOf)                                                                 |    19 |     0 |      1 | –        |
