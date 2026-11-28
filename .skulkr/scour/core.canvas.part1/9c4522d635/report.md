# core.canvas.part1: saturation

Repeated blind reviews of the area `core.canvas.part1` (39 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: the next occasion's chance of a new finding is under 15% (14.6%). The next defect should cost about $2.56. `skulkr scour report core.canvas.part1` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.10 |    $0.03 |     0.2 |
|   2 | claude |        3 |   3 |        6 |   6 |   0 |       13.5 |    7.5 |   100.0% | $1.68 |    $0.30 |     3.9 |
|   3 | claude |        2 |   1 |        7 |   6 |   1 |       19.0 |   12.0 |    64.3% | $1.19 |    $0.42 |     2.1 |
|   4 | claude |        2 |   2 |        9 |   8 |   1 |       33.0 |   24.0 |    73.8% | $1.37 |    $0.48 |     4.6 |
|   5 | claude |        1 |   1 |       10 |   9 |   1 |       42.4 |   32.4 |    77.5% | $1.10 |    $0.54 |     3.8 |
|   6 | claude |        2 |   0 |       10 |   8 |   1 |       36.7 |   26.7 |    58.6% | $0.88 |    $0.63 |     3.2 |
|   7 | claude |        2 |   1 |       11 |   9 |   0 |       41.9 |   30.9 |    60.0% | $0.81 |    $0.65 |     2.7 |
|   8 | claude |        2 |   1 |       12 |  10 |   0 |       51.4 |   39.4 |    58.8% | $0.76 |    $0.66 |     2.8 |
|   9 | claude |        3 |   1 |       13 |   9 |   2 |       31.0 |   18.0 |    42.6% | $0.76 |    $0.66 |     2.4 |
|  10 | claude |        4 |   2 |       15 |  10 |   2 |       37.5 |   22.5 |    39.9% | $0.82 |    $0.63 |     2.4 |
|  11 | claude |        2 |   0 |       15 |  10 |   1 |       60.5 |   45.5 |    37.7% | $1.06 |    $0.70 |     3.8 |
|  12 | claude |        5 |   1 |       16 |  10 |   2 |       38.9 |   22.9 |    31.1% | $0.93 |    $0.72 |     3.1 |
|  13 | claude |        1 |   0 |       16 |  10 |   2 |       39.1 |   23.1 |    30.2% | $0.68 |    $0.76 |     2.3 |
|  14 | claude |        4 |   0 |       16 |   9 |   2 |       34.8 |   18.8 |    24.2% | $1.02 |    $0.82 |     3.7 |
|  15 | claude |        2 |   1 |       17 |  10 |   2 |       40.3 |   23.3 |    25.6% | $0.68 |    $0.81 |     2.2 |
|  16 | claude |        2 |   1 |       18 |  11 |   2 |       46.4 |   28.4 |    26.8% | $0.78 |    $0.81 |     2.6 |
|  17 | claude |        3 |   1 |       19 |  12 |   1 |       86.8 |   67.8 |    27.6% | $1.07 |    $0.83 |     3.1 |
|  18 | claude |        3 |   0 |       19 |  11 |   2 |       47.6 |   28.6 |    23.4% | $1.18 |    $0.89 |     4.1 |
|  19 | claude |        2 |   0 |       19 |  10 |   3 |       34.8 |   15.8 |    20.2% | $0.71 |    $0.93 |     2.3 |
|  20 | claude |        1 |   0 |       19 |  10 |   3 |       34.8 |   15.8 |    19.8% | $0.93 |    $0.97 |     2.8 |
|  21 | claude |        2 |   1 |       20 |  11 |   3 |       39.2 |   19.2 |    21.0% | $1.03 |    $0.98 |     3.4 |
|  22 | claude |        3 |   0 |       20 |  10 |   4 |       31.9 |   11.9 |    17.8% | $0.87 |    $1.02 |     3.0 |
|  23 | claude |        3 |   1 |       21 |   9 |   6 |       27.5 |    6.5 |    14.6% | $0.87 |    $1.01 |     3.3 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        3 |          – |      – |        – |       – |
| claude         | Chao2     |        22 |       20 |       31.9 |   11.9 |    17.5% |       – |
| all sources    | Chao2     |        23 |       21 |       27.5 |    6.5 |    14.6% |       – |
| codex × claude | Chapman   |         – |       21 |       27.0 |    6.0 |        – |       2 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                                            | where                                                                                                                                  | first | codex | claude | severity |
|-----|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | A refused unavailable backend blocks a different backend permanently on the same unopened canvas, via a backend-independent refusal set                                                           | packages/core/src/canvas/canvasRenderer.ts:222 (refuse / bind guard)                                                                   |     1 |     1 |      0 | medium   |
| D2  | Command rasterization yields negative source extents for a flipped view (negative y scale), which raster validation rejects                                                                       | packages/core/src/canvas/commandRasterizer.ts:46                                                                                       |     1 |     1 |      1 | medium   |
| D3  | Content bounds include copies of a group's own box that the draw tree never draws, inflating zoom-to-fit and minimap framing                                                                      | packages/core/src/canvas/contentBounds.ts:32                                                                                           |     1 |     1 |      1 | medium   |
| D4  | buildSceneLayer's toPose shim spreads the adapter, dropping prototype methods of a class-based adapter                                                                                            | packages/core/src/canvas/buildSceneLayer.ts:226 (buildSceneLayer, hierarchicalAdapter)                                                 |     2 |     0 |      9 | –        |
| D5  | Without toPose, a bare adapter's derived paths read dependencies at local poses while the toPose path composes them                                                                               | packages/core/src/canvas/buildSceneLayer.ts:169 (withAdapterDerivedPaths) / packages/core/src/canvas/adapterDerivedPath.ts:37 (poseOf) |     2 |     0 |      9 | –        |
| D6  | watchThemeOf stops at a shadow root, so a canvas in shadow DOM never hears document theme changes                                                                                                 | packages/core/src/canvas/accentColor.ts:60 (watchThemeOf)                                                                              |     2 |     0 |      2 | –        |
| D7  | sceneContentBounds still counts a consuming container's operands when the container sits on a hidden layer and draws copies, so hidden content inflates the bounds                                | packages/core/src/canvas/contentBounds.ts:41 (sceneContentBounds)                                                                      |     3 |     0 |      3 | –        |
| D8  | The adapter pick walk picks a child id the adapter has no node for, while the paint walk skips that id and its subtree                                                                            | packages/core/src/canvas/adapterPickSource.ts:40 (nodeOf), :55 (order/visit)                                                           |     4 |     0 |      3 | –        |
| D9  | The scene slot's objects path records debug bounds for culled nodes and records origins at the stored pose, unlike the tree path                                                                  | packages/core/src/canvas/buildSceneLayer.ts:245 (buildSceneLayer, cfg.objects branch)                                                  |     4 |     0 |      8 | –        |
| D10 | A <CanvasView>'s chrome hit radii ignore the targets.*Px kit settings that the surface's chrome uses                                                                                              | packages/core/src/canvas/affordanceAt.ts:70 (chromeAffordances)                                                                        |     5 |     0 |      1 | –        |
| D11 | A bare scene slot's shapes option reaches clips and LOD but not the painter lookup, so slot shapes are not painted by their painters                                                              | packages/core/src/canvas/buildSceneLayer.ts:192 (buildSceneLayer, filteredDrawOne) and :247 (objects path)                             |     7 |     0 |      1 | –        |
| D12 | commandRasterizer assumes the page view is axis-aligned, so a rotated or skewed view rasterizes wrong                                                                                             | packages/core/src/canvas/commandRasterizer.ts:47 (commandRasterizer)                                                                   |     8 |     0 |      2 | –        |
| D13 | A LOD rung the painter does not paint falls back to the full paint but drops the label overlay                                                                                                    | packages/core/src/canvas/defaultDrawOne.ts:52 (defaultDrawOne)                                                                         |     9 |     0 |      5 | –        |
| D14 | adapterPickSource picks nodes on a layer the adapter reports visible: false, which buildSceneTree never paints                                                                                    | packages/core/src/canvas/adapterPickSource.ts:52 (adapterPickSource → order/visit)                                                     |    10 |     0 |      1 | –        |
| D15 | useChromeColor's changed subscription, made before the canvas element mounts, watches only <html> permanently and never re-targets the canvas's theme scope                                       | packages/core/src/canvas/accentColor.ts:65 (watchThemeOf), :85 (useChromeColor)                                                        |    10 |     0 |      1 | –        |
| D16 | A container's clip is built from its undrawn world pose while its paint uses drawnPose, so the clip and the drawn content disagree                                                                | packages/core/src/canvas/buildSceneTree.ts:253 (visit, ownClipOf(..., pose, ...))                                                      |    12 |     0 |      1 | –        |
| D17 | nodeShapeEntries' doc comment states an evaluation order that contradicts the order the module actually uses                                                                                      | packages/core/src/canvas/NodeShape.ts:271 (nodeShapeEntries)                                                                           |    15 |     0 |      2 | –        |
| D18 | GestureReason places the refusal tag from the view and element rect, ignoring the canvas's clientToWorld override that the dev HUDs honor, so the tag lands in the wrong place                    | packages/core/src/canvas/GestureReason.tsx:50 (GestureReason, surface source toCanvas)                                                 |    16 |     0 |      1 | –        |
| D19 | Under a rotated container, an adapter-resolved derived path gets the inherited rotation applied twice, while the scene path undoes it                                                             | packages/core/src/canvas/buildSceneLayer.ts:133 (withAdapterDerivedPaths)                                                              |    17 |     0 |      2 | –        |
| D20 | Dev HUDs decide whether the pointer is in the canvas from the bounding rect, while world coordinates come from the layout box or toWorld, so the two disagree on a transformed or bordered canvas | packages/core/src/canvas/PickHud.tsx:72 (PickHud onMove); packages/core/src/canvas/CursorCoordsHud.tsx:104 (CursorCoordsHud onMove)    |    21 |     0 |      1 | –        |
| D21 | A cfg.objects scene slot never applies level of detail, so painter LOD ladders never switch rungs there                                                                                           | packages/core/src/canvas/buildSceneLayer.ts:256 (buildSceneLayer, cfg.objects branch)                                                  |    23 |     0 |      1 | –        |
