# core.canvas.SceneCanvas.part1: saturation

Repeated blind reviews of the area `core.canvas.SceneCanvas.part1` (45 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, or 40 occasions have run.
Stopped: the next occasion's chance of a new finding is under 15% (14.6%). `skulkr saturate report core.canvas.SceneCanvas.part1` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.14 |    $0.07 |     0.2 |
|   2 | claude |        5 |   4 |        6 |   5 |   1 |       12.3 |    6.3 |    51.0% | $1.35 |    $0.25 |     2.9 |
|   3 | claude |        5 |   3 |        9 |   7 |   1 |       25.3 |   16.3 |    51.0% | $1.21 |    $0.30 |     2.4 |
|   4 | claude |        2 |   1 |       10 |   8 |   1 |       34.0 |   24.0 |    52.7% | $1.56 |    $0.43 |     4.9 |
|   5 | claude |        2 |   0 |       10 |   7 |   2 |       19.8 |    9.8 |    38.3% | $0.81 |    $0.51 |     2.4 |
|   6 | claude |        3 |   1 |       11 |   8 |   1 |       37.7 |   26.7 |    40.1% | $0.77 |    $0.53 |     2.0 |
|   7 | claude |        3 |   0 |       11 |   7 |   1 |       32.0 |   21.0 |    30.4% | $0.98 |    $0.62 |     2.3 |
|   8 | claude |        1 |   0 |       11 |   7 |   1 |       32.4 |   21.4 |    29.2% | $0.77 |    $0.69 |     2.2 |
|   9 | claude |        3 |   1 |       12 |   8 |   1 |       40.4 |   28.4 |    29.8% | $1.10 |    $0.72 |     3.2 |
|  10 | claude |        4 |   0 |       12 |   7 |   2 |       23.0 |   11.0 |    21.9% | $0.92 |    $0.80 |     3.0 |
|  11 | claude |        1 |   0 |       12 |   7 |   2 |       23.1 |   11.1 |    21.4% | $0.66 |    $0.86 |     1.8 |
|  12 | claude |        2 |   0 |       12 |   7 |   2 |       23.2 |   11.2 |    20.2% | $0.61 |    $0.91 |     2.0 |
|  13 | claude |        1 |   0 |       12 |   7 |   2 |       23.3 |   11.3 |    19.7% | $0.68 |    $0.96 |     2.1 |
|  14 | claude |        1 |   1 |       13 |   8 |   2 |       27.9 |   14.9 |    22.0% | $0.96 |    $0.96 |     2.8 |
|  15 | claude |        3 |   1 |       14 |   9 |   2 |       32.9 |   18.9 |    23.0% | $0.76 |    $0.95 |     2.4 |
|  16 | claude |        5 |   2 |       16 |  11 |   2 |       44.4 |   28.4 |    25.0% | $0.77 |    $0.88 |     2.6 |
|  17 | claude |        2 |   0 |       16 |  11 |   1 |       72.9 |   56.9 |    24.2% | $0.95 |    $0.94 |     2.9 |
|  18 | claude |        1 |   0 |       16 |  11 |   1 |       73.1 |   57.1 |    23.7% | $0.52 |    $0.97 |     2.0 |
|  19 | claude |        2 |   0 |       16 |  10 |   2 |       39.7 |   23.7 |    20.4% | $1.24 |    $1.05 |     4.1 |
|  20 | claude |        4 |   0 |       16 |  10 |   2 |       39.8 |   23.8 |    18.8% | $0.80 |    $1.10 |     2.5 |
|  21 | claude |        3 |   1 |       17 |   9 |   4 |       26.6 |    9.6 |    15.4% | $0.69 |    $1.07 |     2.3 |
|  22 | claude |        3 |   0 |       17 |   9 |   4 |       26.7 |    9.7 |    14.6% | $0.75 |    $1.12 |     2.6 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |        21 |       16 |       23.6 |    7.6 |    13.4% |       – |
| all sources    | Chao2     |        22 |       17 |       26.7 |    9.7 |    14.6% |       – |
| codex × claude | Chapman   |         – |       17 |       24.5 |    7.5 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                        | where                                                                                              | first | codex | claude | severity |
|-----|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | A preset refinement cycle with conflicting layer-key values crashes key merging by dereferencing an undefined top provider instead of rejecting the cycle with the preset IDs | packages/core/src/canvas/SceneCanvas/presetMerge.ts:47                                             |     1 |     1 |     17 | medium   |
| D2  | Copy picking measures tolerance with a scalar scale, so an anisotropic copy transform rejects ink visibly within the screen grab band                                         | packages/core/src/canvas/SceneCanvas/scenePointQuery.ts:54                                         |     1 |     1 |      0 | medium   |
| D3  | Toggling any one preset re-runs every preset's build, breaking build's once-per-canvas-and-preset contract                                                                    | packages/core/src/canvas/SceneCanvas/presetBuild.ts:125 (usePresetBuilds, second useMemo)          |     2 |     0 |      2 | –        |
| D4  | useStableToolOptions content key collides for strings containing its separators, so stale tool options are kept                                                               | packages/core/src/canvas/SceneCanvas/presetBuild.ts:141 (contentKeyOf)                             |     2 |     0 |      5 | –        |
| D5  | describePresets attributes an included preset to the including package instead of the package that ships it                                                                   | packages/core/src/canvas/SceneCanvas/describePresets.ts:37 (visit)                                 |     2 |     0 |      1 | –        |
| D6  | DevHuds.toWorld keeps the previous view id when the canvas api is missing                                                                                                     | packages/core/src/canvas/SceneCanvas/DevHuds.tsx:47 (toWorld)                                      |     2 |     0 |      6 | –        |
| D7  | describePresets silently drops a second, different preset sharing an id, where the canvas throws                                                                              | packages/core/src/canvas/SceneCanvas/describePresets.ts:31 (describePresets)                       |     3 |     0 |      1 | –        |
| D8  | Insert preview loses precision far from the origin                                                                                                                            | packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:32 (insertPreviewCommands, toScreen) |     3 |     0 |      1 | –        |
| D9  | A frame hook shared by two contributions has its second failure swallowed silently                                                                                            | packages/core/src/canvas/SceneCanvas/contributionFrameHooks.ts:31 (runContributionFrameHooks)      |     3 |     0 |      1 | –        |
| D10 | An image insert preview is drawn upright under a flipped view while the outlines beside it are flipped                                                                        | packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:68 (insertPreviewCommands)           |     4 |     0 |     13 | –        |
| D11 | A partial selectionOverlay.handles override drops the device-scaled default handle size                                                                                       | packages/core/src/canvas/SceneCanvas/mergeLayers.ts:63 (mergeLayersWithDefaults)                   |     6 |     0 |      2 | –        |
| D12 | isAtom reports a preset whose selectionChrome is a class instance as a bundle                                                                                                 | packages/core/src/canvas/SceneCanvas/describePresets.ts:20 (filled / isAtom)                       |     9 |     0 |      1 | –        |
| D13 | Gesture bounds of an in-flight insert omit its copies, which the preview paints                                                                                               | packages/core/src/canvas/SceneCanvas/dispatcherGestureBounds.ts:47 (dispatcherInsertBounds)        |    14 |     0 |      2 | –        |
| D14 | The features.ts module doc lists editing's presets as if core ships them                                                                                                      | packages/core/src/canvas/SceneCanvas/features.ts:10 (module doc)                                   |    15 |     0 |      1 | –        |
| D15 | A singular copy matrix makes the pick query's tolerance (slop) Infinity or NaN                                                                                                | packages/core/src/canvas/SceneCanvas/scenePointQuery.ts:59 (bareQuery.inCopy)                      |    16 |     0 |      2 | –        |
| D16 | Two contributions declaring a view or marker with the same id collide on one React key                                                                                        | packages/core/src/canvas/SceneCanvas/SurfaceDeclarations.tsx:16 (SurfaceDeclarations)              |    16 |     0 |      1 | –        |
| D17 | The image insert preview is not drawn for the insert's copies, while the outlines are                                                                                         | packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:68 (insertPreviewCommands)           |    21 |     0 |      1 | –        |
