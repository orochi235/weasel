# core.canvas.part4: saturation

Repeated blind reviews of the area `core.canvas.part4` (37 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, or 40 occasions have run.
Stopped: the next occasion's chance of a new finding is under 15% (14.8%). `skulkr saturate report core.canvas.part4` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.14 |    $0.07 |     0.2 |
|   2 | claude |        4 |   4 |        6 |   6 |   0 |       13.5 |    7.5 |   100.0% | $1.07 |    $0.20 |     2.6 |
|   3 | claude |        2 |   1 |        7 |   6 |   1 |       19.0 |   12.0 |    64.3% | $0.95 |    $0.31 |     1.7 |
|   4 | claude |        2 |   1 |        8 |   6 |   2 |       14.8 |    6.8 |    49.1% | $0.69 |    $0.36 |     2.5 |
|   5 | claude |        3 |   3 |       11 |   9 |   2 |       27.2 |   16.2 |    62.3% | $0.77 |    $0.33 |     2.7 |
|   6 | claude |        4 |   3 |       14 |  12 |   1 |       74.0 |   60.0 |    68.3% | $0.57 |    $0.30 |     1.9 |
|   7 | claude |        3 |   1 |       15 |  11 |   3 |       32.3 |   17.3 |    48.0% | $0.68 |    $0.32 |     2.3 |
|   8 | claude |        5 |   4 |       19 |  14 |   4 |       40.4 |   21.4 |    49.8% | $0.96 |    $0.31 |     3.1 |
|   9 | claude |        2 |   0 |       19 |  14 |   3 |       48.0 |   29.0 |    47.5% | $0.51 |    $0.33 |     1.8 |
|  10 | claude |        2 |   0 |       19 |  14 |   1 |      107.2 |   88.2 |    45.9% | $0.64 |    $0.37 |     2.1 |
|  11 | claude |        2 |   0 |       19 |  13 |   2 |       57.4 |   38.4 |    39.4% | $0.57 |    $0.40 |     1.6 |
|  12 | claude |        4 |   0 |       19 |  11 |   3 |       37.5 |   18.5 |    29.1% | $0.66 |    $0.43 |     2.3 |
|  13 | claude |        8 |   4 |       23 |  14 |   3 |       53.2 |   30.2 |    30.0% | $1.52 |    $0.42 |     4.9 |
|  14 | claude |        3 |   0 |       23 |  13 |   3 |       49.2 |   26.2 |    26.2% | $0.63 |    $0.45 |     2.4 |
|  15 | claude |        3 |   0 |       23 |  12 |   4 |       39.8 |   16.8 |    22.5% | $0.70 |    $0.48 |     2.3 |
|  16 | claude |        2 |   0 |       23 |  12 |   4 |       39.9 |   16.9 |    21.7% | $0.52 |    $0.50 |     1.9 |
|  17 | claude |        3 |   0 |       23 |  12 |   3 |       45.6 |   22.6 |    20.8% | $0.55 |    $0.53 |     2.1 |
|  18 | claude |        2 |   0 |       23 |  12 |   3 |       45.7 |   22.7 |    20.1% | $0.56 |    $0.55 |     1.9 |
|  19 | claude |        4 |   1 |       24 |  12 |   4 |       41.1 |   17.1 |    18.7% | $0.80 |    $0.56 |     2.7 |
|  20 | claude |        3 |   0 |       24 |  12 |   3 |       46.8 |   22.8 |    18.0% | $0.66 |    $0.59 |     1.9 |
|  21 | claude |        3 |   0 |       24 |  11 |   4 |       38.4 |   14.4 |    15.6% | $0.63 |    $0.62 |     2.1 |
|  22 | claude |        3 |   0 |       24 |  11 |   2 |       52.9 |   28.9 |    15.2% | $0.73 |    $0.65 |     2.1 |
|  23 | claude |        2 |   0 |       24 |  11 |   2 |       52.9 |   28.9 |    14.8% | $0.69 |    $0.67 |     2.2 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |        22 |       23 |       46.9 |   23.9 |    13.8% |       – |
| all sources    | Chao2     |        23 |       24 |       52.9 |   28.9 |    14.8% |       – |
| codex × claude | Chapman   |         – |       24 |       35.0 |   11.0 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                | where                                                                                                                                  | first | codex | claude | severity |
|-----|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Cyclic view parents make drawnLayers()/layerIsPainted recurse unguarded and overflow the stack                                                                        | packages/core/src/canvas/useViewNesting.ts:85                                                                                          |     1 |     1 |      3 | medium   |
| D2  | Explicit width 0 is treated as unresolved, so neither the collapse nor the restore fires onResize                                                                     | packages/core/src/canvas/useSurfaceSize.ts:37                                                                                          |     1 |     1 |      0 | low      |
| D3  | A view's hit-test of the layers it paints is gated by the surface's layerVisibility, but the view's paint ignores it, so hits and paint disagree                      | packages/core/src/canvas/useExtraLayers.ts:63 (hitTestExtrasIn), via packages/core/src/canvas/useViewPicking.ts:56 (affordanceAt)      |     2 |     0 |      7 | –        |
| D4  | Root view markers are memoized on the registry version while a marker's target is read live, so a marker retargeted to or from the root paints in the wrong frame     | packages/core/src/canvas/useLayerStack.ts:78 (useComposedLayers), packages/core/src/canvas/viewMarkers.ts:61 (markerLayers)            |     2 |     0 |      2 | –        |
| D5  | useHostAnchor never recomputes when resolveHost starts naming a different element while a host is already resolved                                                    | packages/core/src/canvas/useHostAnchor.ts:41 (resolve / recompute), :80 (watch effect)                                                 |     2 |     0 |      1 | –        |
| D6  | A nested view with a missing parent derives its camera against the surface but its rect collapses to nothing, so camera and rect disagree                             | packages/core/src/canvas/useViewNesting.ts:47 (derivedAt) vs :37 (rectAt)                                                              |     2 |     0 |      1 | –        |
| D7  | A static cursor spec that resolveCursor rejects throws out of the canvas render, while the thunk form's throw is caught                                               | packages/core/src/canvas/useToolCursor.ts:10 (resolveToolsCursor)                                                                      |     3 |     0 |      3 | –        |
| D8  | A resize commit whose in-place paint fails schedules no retry and also suppresses the commit path's retry, so the frame stays unpainted                               | packages/core/src/canvas/useCanvasSurface.ts:70 (usePaintOnResize)                                                                     |     4 |     0 |      3 | –        |
| D9  | A marker skipped for a duplicate id is never registered later, so it does not take over when the holder leaves the way a duplicate view does                          | packages/core/src/canvas/viewMarkers.ts:52 (registerMarker)                                                                            |     5 |     0 |     12 | –        |
| D10 | The shader-source watcher splits program ids on '\|', so a program id that contains '\|' never triggers a repaint                                                     | packages/core/src/canvas/useCanvasRenderer.ts:55 (useRedrawOnShaderSource)                                                             |     5 |     0 |      5 | –        |
| D11 | A resize with viewBounds paints one frame in place with the old, unclamped view before the reclamp runs                                                               | packages/core/src/canvas/useCanvasSurface.ts:68 (usePaintOnResize), packages/core/src/canvas/useCanvasView.ts:178 (useReclampOnResize) |     5 |     0 |      1 | –        |
| D12 | A view's hit test of registered/slot layers is given the surface's chrome-caps predicate while its paint uses the view's, so hits and paint disagree on chrome layers | packages/core/src/canvas/useExtraLayers.ts:63 (hitTestExtrasIn)                                                                        |     6 |     0 |      6 | –        |
| D13 | Re-registering a layer object already held by another owner moves it to the top of draw and hit order, and it stays there after that owner releases it                | packages/core/src/canvas/useExtraLayers.ts:37 (registerLayer)                                                                          |     6 |     0 |      3 | –        |
| D14 | With onCommit: 'paint', the first commit is painted through the raw paint function, bypassing the frame loop                                                          | packages/core/src/canvas/useCanvasSurface.ts:61 (useCanvasSurface → useRedrawOnCommit)                                                 |     6 |     0 |      9 | –        |
| D15 | The duplicate-marker check reads the id only at registration, so a props thunk whose id later changes to one already held bypasses it                                 | packages/core/src/canvas/viewMarkers.ts:62 (registerMarker)                                                                            |     7 |     0 |      1 | –        |
| D16 | While its host is unresolved, useHostAnchor recomputes on every attribute change anywhere in the document                                                             | packages/core/src/canvas/useHostAnchor.ts:96 (useHostAnchor, second effect)                                                            |     8 |     0 |      1 | –        |
| D17 | useHostAnchor's first paint shows no position, contrary to its doc                                                                                                    | packages/core/src/canvas/useHostAnchor.ts:77 (useHostAnchor, first effect)                                                             |     8 |     0 |      1 | –        |
| D18 | A view that both follows another view and is nested in a parent skips the parent's layer gate                                                                         | packages/core/src/canvas/useViewNesting.ts:96 (layerIsPainted), :86 (drawnLayers)                                                      |     8 |     0 |      2 | –        |
| D19 | Client-to-world conversion returns the client point unchanged when there is no element                                                                                | packages/core/src/canvas/useClientToWorld.ts:20 (useClientToWorld)                                                                     |     8 |     0 |      1 | –        |
| D20 | Hit-testing of registered and slot layers ignores the order set by layerOrder, so the topmost painted layer is not tested first                                       | packages/core/src/canvas/useExtraLayers.ts:61 (hitTestExtrasIn)                                                                        |    13 |     0 |      1 | –        |
| D21 | A CanvasView's view dep drops contentBounds, animate, decay and recenter, so Fit Content, coasting pans and animated zoom do nothing inside a view                    | packages/core/src/canvas/useViewOwnDeps.ts:16-21 (viewApi)                                                                             |    13 |     0 |      1 | –        |
| D22 | A frame with no renderer still opens a debug frame and records its layers                                                                                             | packages/core/src/canvas/useCanvasPaint.ts:107-118 (paint)                                                                             |    13 |     0 |      3 | –        |
| D23 | When a view's registration rebuilds, its id passes to a duplicate view waiting behind it                                                                              | packages/core/src/canvas/viewRegistry.tsx:186-196 (register / unregister)                                                              |    13 |     0 |      3 | –        |
| D24 | After a frame throws and the next frame does not land, no retry is scheduled, so a later throw leaves the frame unpainted                                             | packages/core/src/canvas/useFrameLoop.ts:79 (runPaint)                                                                                 |    19 |     0 |      1 | –        |
