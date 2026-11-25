# core.canvas.part3: saturation

Repeated blind reviews of the area `core.canvas.part3` (39 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, or 40 occasions have run.
Stopped: the next occasion's chance of a new finding is under 15% (10.4%). `skulkr saturate report core.canvas.part3` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.14 |    $0.07 |     0.2 |
|   2 | claude |        4 |   4 |        6 |   6 |   0 |       13.5 |    7.5 |   100.0% | $1.31 |    $0.24 |     3.0 |
|   3 | claude |        6 |   3 |        9 |   6 |   3 |       13.0 |    4.0 |    33.3% | $1.15 |    $0.29 |     2.6 |
|   4 | claude |        8 |   4 |       13 |   9 |   1 |       43.4 |   30.4 |    41.9% | $0.91 |    $0.27 |     3.5 |
|   5 | claude |        5 |   1 |       14 |   9 |   1 |       46.4 |   32.4 |    34.1% | $0.87 |    $0.31 |     3.2 |
|   6 | claude |        4 |   0 |       14 |   8 |   2 |       27.3 |   13.3 |    25.1% | $0.80 |    $0.37 |     3.1 |
|   7 | claude |        7 |   2 |       16 |   8 |   3 |       25.1 |    9.1 |    19.2% | $0.84 |    $0.38 |     3.4 |
|   8 | claude |        5 |   1 |       17 |   8 |   3 |       26.3 |    9.3 |    17.2% | $0.88 |    $0.41 |     3.2 |
|   9 | claude |        3 |   0 |       17 |   8 |   2 |       31.2 |   14.2 |    16.7% | $1.36 |    $0.49 |     4.5 |
|  10 | claude |        6 |   0 |       17 |   6 |   3 |       22.4 |    5.4 |    10.4% | $1.06 |    $0.55 |     4.3 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |         9 |       15 |       17.4 |    2.4 |     6.7% |       – |
| all sources    | Chao2     |        10 |       17 |       22.4 |    5.4 |    10.4% |       – |
| codex × claude | Chapman   |         – |       17 |       47.0 |   30.0 |        – |       0 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                             | where                                                                                                        | first | codex | claude | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Rendering a looped span past the timeline's duration consumes the caller's remaining laps; restore resets time but not lap counters, so playback ends a pass early | packages/core/src/canvas/timelineFrames.ts:73                                                                |     1 |     1 |      0 | medium   |
| D2  | timelineFrameTimes with default includeEnd:false emits a frame for an empty interval (start == end) because the count floor forces one                             | packages/core/src/canvas/timelineFrames.ts:52 (timelineFrameTimes)                                           |     1 |     1 |      0 | low      |
| D3  | Visibility tree keeps each node's layer tag bit from boxing time, so reordering or inserting a scene layer culls on-screen nodes                                   | packages/core/src/canvas/reach/sceneVisibility.ts:117 (SceneVisibility.tagOf)                                |     2 |     0 |      4 | –        |
| D4  | Tile damage for a node moved to another layer is reported only to its new layer, so the old layer's tiles keep showing it                                          | packages/core/src/canvas/reach/tileDamage.ts:40 (damage callback in createSceneTileSources)                  |     2 |     0 |      8 | –        |
| D5  | Tile damage misses regions where a container paints copies of a changed child                                                                                      | packages/core/src/canvas/reach/reachTree.ts:83 (Tree.touched / report)                                       |     2 |     0 |      9 | –        |
| D6  | rec.joined and queue-depth handling can recompute a record twice, at its stale depth before its new children                                                       | packages/core/src/canvas/reach/reachTree.ts:170 (Tree.apply)                                                 |     2 |     0 |      1 | –        |
| D7  | WideChildren.meeting dedups by a per-container epoch stored on the record, so a reparented child can be skipped                                                    | packages/core/src/canvas/reach/wideChildren.ts:68 (meeting / take)                                           |     3 |     0 |      3 | –        |
| D8  | A tile source's damage queue grows without bound for a layer that stops reading it                                                                                 | packages/core/src/canvas/reach/tileDamage.ts:44-47 (createSceneTileSources)                                  |     3 |     0 |      7 | –        |
| D9  | wireSceneSlotToScene builds a fresh scene-wide reach tree for tiles on every call                                                                                  | packages/core/src/canvas/sceneSlotWiring.ts:85 (wireSceneSlotToScene)                                        |     3 |     0 |      1 | –        |
| D10 | Paste in a non-composing scene leaves a pasted group's children behind at their old position instead of moving them with the group                                 | packages/core/src/canvas/sceneClipboard.ts:259 (pasteSceneSnapshot ridesPastedFrame / placed), :78 (poseFor) |     4 |     0 |      1 | –        |
| D11 | Wide-container childrenMeeting ignores the children argument it is given                                                                                           | packages/core/src/canvas/reach/reachTree.ts:204 (Tree.childrenMeeting)                                       |     4 |     0 |      1 | –        |
| D12 | WebGPU readback: an earlier region read that resolves late overwrites last with stale pixels                                                                       | packages/core/src/canvas/readback.ts:86 (createCanvasReader.region)                                          |     4 |     0 |      3 | –        |
| D13 | stubCanvasContext replaces HTMLCanvasElement prototype methods with no way to restore them                                                                         | packages/core/src/canvas/testing/stubCanvasContext.ts:5 (stubCanvasContext)                                  |     4 |     0 |      3 | –        |
| D14 | readGl positions the read using the canvas height instead of the drawing buffer's height, so the region it reads is offset when the two differ                     | packages/core/src/canvas/readback.ts:51, :83 (readGl, createCanvasReader)                                    |     5 |     0 |      2 | –        |
| D15 | Asking a tile source for a layer's damage queue twice creates a second queue and orphans the first, which keeps collecting damage nothing drains                   | packages/core/src/canvas/reach/tileDamage.ts:42 (returned per-layer function)                                |     7 |     0 |      2 | –        |
| D16 | debugSnapshotArgs lets an explicit `annotations: undefined` override its default of true                                                                           | packages/core/src/canvas/renderDebugSnapshot.ts:52 (debugSnapshotArgs)                                       |     7 |     0 |      3 | –        |
| D17 | Pasting a multi-level cluster into a container on a higher layer throws                                                                                            | packages/core/src/canvas/sceneClipboard.ts:268 (pasteSceneSnapshot, layerOf)                                 |     8 |     0 |      2 | –        |
