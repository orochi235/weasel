# core.canvas.part2: saturation

Repeated blind reviews of the area `core.canvas.part2` (39 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, or 40 occasions have run.
Stopped: the next occasion's chance of a new finding is under 15% (14.0%). `skulkr saturate report core.canvas.part2` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.14 |    $0.07 |     0.2 |
|   2 | claude |        6 |   6 |        8 |   8 |   0 |       22.0 |   14.0 |   100.0% | $1.20 |    $0.17 |     3.0 |
|   3 | claude |        3 |   1 |        9 |   7 |   2 |       17.2 |    8.2 |    49.5% | $1.07 |    $0.27 |     2.1 |
|   4 | claude |        4 |   2 |       11 |   8 |   2 |       23.0 |   12.0 |    45.7% | $0.72 |    $0.28 |     2.7 |
|   5 | claude |        6 |   3 |       14 |  10 |   2 |       34.0 |   20.0 |    43.3% | $0.65 |    $0.27 |     2.6 |
|   6 | claude |        5 |   0 |       14 |   9 |   1 |       47.8 |   33.8 |    33.1% | $0.59 |    $0.31 |     2.6 |
|   7 | claude |        4 |   3 |       17 |  12 |   1 |       78.7 |   61.7 |    38.9% | $0.49 |    $0.29 |     2.0 |
|   8 | claude |        5 |   1 |       18 |  12 |   2 |       49.5 |   31.5 |    32.7% | $0.88 |    $0.32 |     2.7 |
|   9 | claude |        3 |   0 |       18 |  12 |   2 |       50.0 |   32.0 |    30.3% | $0.55 |    $0.35 |     2.2 |
|  10 | claude |        6 |   1 |       19 |  12 |   2 |       51.4 |   32.4 |    26.3% | $0.57 |    $0.36 |     2.2 |
|  11 | claude |        5 |   0 |       19 |  11 |   2 |       46.5 |   27.5 |    21.7% | $0.55 |    $0.39 |     2.2 |
|  12 | claude |        6 |   0 |       19 |  10 |   2 |       41.9 |   22.9 |    17.5% | $0.54 |    $0.42 |     2.0 |
|  13 | claude |        5 |   0 |       19 |  10 |   0 |       60.5 |   41.5 |    16.7% | $0.52 |    $0.45 |     1.9 |
|  14 | claude |        3 |   0 |       19 |   9 |   1 |       56.6 |   37.6 |    14.0% | $0.86 |    $0.49 |     3.4 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |        13 |       17 |       39.6 |   22.6 |    11.2% |       – |
| all sources    | Chao2     |        14 |       19 |       56.6 |   37.6 |    14.0% |       – |
| codex × claude | Chapman   |         – |       19 |       53.0 |   34.0 |        – |       0 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                            | where                                                                                                     | first | codex | claude | severity |
|-----|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | A numeric component after a wildcard in a contribution requirement (e.g. core: '1.x.7') is silently dropped, so the range passes at 1.8.0 instead of being rejected as unreadable | packages/core/src/canvas/kitRequirements.ts:68                                                            |     1 |     1 |      0 | low      |
| D2  | Finite validated source width and scale can multiply to infinite or over-limit pixel dimensions that reach canvas sizing and buffer allocation unchecked                          | packages/core/src/canvas/pixelRenderRect.ts:28                                                            |     1 |     1 |      0 | medium   |
| D3  | A fitted insert extent reports lands' full size on an axis where its geometry has no extent                                                                                       | packages/core/src/canvas/insertPreviewExtent.ts:64 (fitted)                                               |     2 |     0 |     10 | –        |
| D4  | collapsedAbove is documented as the nearest collapsed ancestor but implemented as the outermost                                                                                   | packages/core/src/canvas/lod/lodState.ts:17 (LodState.collapsedAbove), :50 (createLodState)               |     2 |     0 |      3 | –        |
| D5  | after: '' counts as an anchor in the both-anchors check but not in placement                                                                                                      | packages/core/src/canvas/layerOrder.ts:47 (composeOrderedLayers)                                          |     2 |     0 |      1 | –        |
| D6  | The default registry's id-conflict check does not see the built-in shapes it already holds                                                                                        | packages/core/src/canvas/nodeShapeRegistry.ts:122 (createNodeShapes → register)                           |     2 |     0 |      1 | –        |
| D7  | byCollapse caches a ladder for every distinct collapseBelowPx with no bound on its size                                                                                           | packages/core/src/canvas/lod/lodWalk.ts:59, :79 (collapseRungs)                                           |     2 |     0 |     12 | –        |
| D8  | checkPixelRenderRect's doc says it imports nothing, but it imports @weasel-js/registry                                                                                            | packages/core/src/canvas/pixelRenderRect.ts:1                                                             |     2 |     0 |      1 | –        |
| D9  | A scene layer's LOD record outlives the layer's walks, so stale picks answer rungOf/skips for nodes the view no longer draws that way                                             | packages/core/src/canvas/lod/lodState.ts:42 (createLodState find, begin/end)                              |     3 |     0 |      4 | –        |
| D10 | paintLodBox memoizes the box fill without keying on inherited, so an 'inherit' fill goes stale                                                                                    | packages/core/src/canvas/lod/lodBox.ts:33 (paintLodBox)                                                   |     4 |     0 |     10 | –        |
| D11 | Painted cursor averages signed view scales, so a mirrored view shrinks or hides a world-sized cursor                                                                              | packages/core/src/canvas/paintedCursorLayer.ts:86 (createPaintedCursorLayer draw)                         |     4 |     0 |      3 | –        |
| D12 | The pick index rebuilds only when the scene or markers change, so it goes stale when painters or outside geometry change                                                          | packages/core/src/canvas/pickIndex/scenePickIndex.ts:113 (PickIndex.source → changesSince), :82 (current) |     5 |     0 |      1 | –        |
| D13 | resetNodeShapesForTests leaves the memoized evaluation order still serving the painters it removed                                                                                | packages/core/src/canvas/nodeShapeRegistry.ts:113 (resetNodeShapesForTests)                               |     5 |     0 |      3 | –        |
| D14 | clipboardFault names the wrong item when a parent chain runs into a loop the item is not part of                                                                                  | packages/core/src/canvas/pasteShape.ts:44 (clipboardFault)                                                |     5 |     0 |      1 | –        |
| D15 | Under a zero-scale view a ladder sized Infinity picks the coarsest rung instead of the finest                                                                                     | packages/core/src/canvas/lod/lodWalk.ts:139 (createLodWalk pick)                                          |     7 |     0 |      1 | –        |
| D16 | Non-finite sides/points in an insert preview's extras reach the polygon/star path builders as NaN                                                                                 | packages/core/src/canvas/insertPreviewExtent.ts:103 (extentOf, polygon / star cases)                      |     7 |     0 |      1 | –        |
| D17 | satisfiesRange rejects an empty range as invalid, where npm reads it as '*'                                                                                                       | packages/core/src/canvas/kitRequirements.ts:139 (satisfiesRange)                                          |     7 |     0 |      4 | –        |
| D18 | A node lod naming the same rung twice resolves prev to the first occurrence, breaking hysteresis                                                                                  | packages/core/src/canvas/lod/lodWalk.ts:136 (createLodWalk → pick)                                        |     8 |     0 |      2 | –        |
| D19 | A group never reads its painter's ladder, so groups only ever get collapseBelowPx rungs                                                                                           | packages/core/src/canvas/lod/lodWalk.ts:127 (createLodWalk pick)                                          |    10 |     0 |      3 | –        |
