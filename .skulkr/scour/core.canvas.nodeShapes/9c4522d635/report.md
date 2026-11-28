# core.canvas.nodeShapes: saturation

Repeated blind reviews of the area `core.canvas.nodeShapes` (12 files, 1040 lines) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 18.3 known defects per thousand lines, at least 5. The next defect should cost about $2.11. `skulkr scour report core.canvas.nodeShapes` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.14 |    $0.07 |     0.2 |
|   2 | claude |        3 |   3 |        5 |   5 |   0 |       10.0 |    5.0 |   100.0% | $0.80 |    $0.19 |     2.2 |
|   3 | claude |        2 |   1 |        6 |   5 |   1 |       14.3 |    8.3 |    59.5% | $0.92 |    $0.31 |     2.6 |
|   4 | claude |        1 |   0 |        6 |   5 |   0 |       13.5 |    7.5 |    62.5% | $1.73 |    $0.60 |     3.8 |
|   5 | claude |        5 |   4 |       10 |   8 |   1 |       35.6 |   25.6 |    53.8% | $0.99 |    $0.46 |     2.4 |
|   6 | claude |        4 |   1 |       11 |   8 |   1 |       37.7 |   26.7 |    42.3% | $0.52 |    $0.46 |     1.9 |
|   7 | claude |        2 |   0 |       11 |   7 |   2 |       21.5 |   10.5 |    32.0% | $0.67 |    $0.52 |     2.3 |
|   8 | claude |        2 |   0 |       11 |   7 |   2 |       21.7 |   10.7 |    29.4% | $0.47 |    $0.57 |     1.8 |
|   9 | claude |        3 |   0 |       11 |   6 |   2 |       19.0 |    8.0 |    22.2% | $0.64 |    $0.63 |     2.2 |
|  10 | claude |        2 |   0 |       11 |   6 |   2 |       19.1 |    8.1 |    20.7% | $0.63 |    $0.68 |     2.5 |
|  11 | claude |        3 |   1 |       12 |   7 |   2 |       23.1 |   11.1 |    22.1% | $0.77 |    $0.69 |     2.8 |
|  12 | claude |        3 |   1 |       13 |   8 |   1 |       42.3 |   29.3 |    23.7% | $0.65 |    $0.69 |     2.3 |
|  13 | claude |        1 |   0 |       13 |   8 |   1 |       42.5 |   29.5 |    23.0% | $0.46 |    $0.72 |     1.9 |
|  14 | claude |        3 |   0 |       13 |   8 |   0 |       39.0 |   26.0 |    21.6% | $0.77 |    $0.78 |     2.5 |
|  15 | claude |        3 |   1 |       14 |   9 |   0 |       47.6 |   33.6 |    22.5% | $0.87 |    $0.79 |     3.0 |
|  16 | claude |        1 |   0 |       14 |   9 |   0 |       47.8 |   33.8 |    22.0% | $0.51 |    $0.82 |     2.0 |
|  17 | claude |        3 |   2 |       16 |  11 |   0 |       67.8 |   51.8 |    25.0% | $0.57 |    $0.76 |     2.4 |
|  18 | claude |        4 |   2 |       18 |  12 |   1 |       86.0 |   68.0 |    24.8% | $0.70 |    $0.71 |     2.6 |
|  19 | claude |        4 |   0 |       18 |  10 |   3 |       33.8 |   15.8 |    18.3% | $0.82 |    $0.76 |     2.9 |
|  20 | claude |        3 |   1 |       19 |  11 |   2 |       47.7 |   28.7 |    18.9% | $0.63 |    $0.75 |     2.4 |
|  21 | claude |        3 |   0 |       19 |   9 |   3 |       31.9 |   12.9 |    14.0% | $1.36 |    $0.82 |     3.1 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |        20 |       18 |       28.1 |   10.1 |    12.8% |       – |
| all sources    | Chao2     |        21 |       19 |       31.9 |   12.9 |    14.0% |       – |
| codex × claude | Chapman   |         – |       19 |       27.5 |    8.5 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                         | where                                                                                                                                                     | first | codex | claude | severity |
|-----|------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | A non-finite legacy polygon sides or star points count reaches the builder unvalidated and its vertex loop never ends, stalling painting       | packages/core/src/canvas/nodeShapes/shapePainter.ts:99                                                                                                    |     1 |     1 |      3 | medium   |
| D2  | Bounds ignore animated trim, so a square-capped smooth shape's cap overhang falls outside the reported drawn box                               | packages/core/src/canvas/nodeShapes/shapePainter.ts:73                                                                                                    |     1 |     1 |      0 | medium   |
| D3  | strokedBounds includes the stroke ribbon for a stroke with no paint that only draws marker heads, overstating bounds                           | packages/core/src/canvas/nodeShapes/strokedBounds.ts:30 (strokedBounds)                                                                                   |     2 |     0 |     17 | medium   |
| D4  | A group's box border bounds use a uniform outset, disagreeing with kit:shape's measurement of the same rect when its stroke protrudes          | packages/core/src/canvas/nodeShapes/groupBoxPainter.ts:61 (groupBoxDrawnBounds)                                                                           |     2 |     0 |      1 | –        |
| D5  | FRAMED pick cache keyed on pose identity picks against a stale outline when a pose buffer is mutated in place                                  | packages/core/src/canvas/nodeShapes/derivedPainter.ts:29 (framedPart)                                                                                     |     2 |     0 |      8 | medium   |
| D6  | hasStroke duplicates strokeHasInk but omits its non-finite-dash test, so the two disagree on whether a stroke with a non-finite dash draws ink | packages/core/src/canvas/nodeShapes/nodePaint.ts:136 (hasStroke)                                                                                          |     3 |     0 |      4 | low      |
| D7  | A rect's or ellipse's drawn bounds grow every side by the widest per-vertex stroke width, not the width at each side                           | packages/core/src/canvas/nodeShapes/shapePainter.ts:83 (SHAPE_PAINTER.drawnBounds)                                                                        |     5 |     0 |      1 | low      |
| D8  | hasStroke and inkReach disagree on whether a stroke width has ink                                                                              | packages/core/src/canvas/nodeShapes/nodePaint.ts:143 (hasStroke)                                                                                          |     5 |     0 |      7 | low      |
| D9  | kit:path-pose re-tessellates the stroke on every drawnBounds call                                                                              | packages/core/src/canvas/nodeShapes/pathPosePainter.ts:37 (PATH_POSE_PAINTER.drawnBounds)                                                                 |     5 |     0 |      2 | low      |
| D10 | kit:derived re-tessellates the stroke on every drawnBounds call                                                                                | packages/core/src/canvas/nodeShapes/derivedPainter.ts:47 (derivedDrawnBounds)                                                                             |     5 |     0 |      1 | low      |
| D11 | A paint-less marked stroke's invisible line is grabbable by pick at the head's reach, because inkReach counts the line as ink.                 | packages/core/src/canvas/nodeShapes/nodePaint.ts:33 (inkReach)                                                                                            |     6 |     0 |      1 | low      |
| D12 | kit:derived's ink reads the node's own paint for a path drawn in parts, so the pick index and area select disagree with what the parts paint   | packages/core/src/canvas/nodeShapes/derivedPainter.ts:116 (DERIVED_PAINTER.ink); packages/core/src/canvas/nodeShapes/pathPainter.ts:44 (PATH_PAINTER.ink) |    11 |     0 |      2 | medium   |
| D13 | outsetPoseBox under-outsets a mitered { px } rect under a skewed screen map, so the drawn bounds fall short of the stroke.                     | packages/core/src/canvas/nodeShapes/strokedBounds.ts:139 (outsetPoseBox)                                                                                  |    12 |     0 |      1 | low      |
| D14 | strokedBounds pads an absolute path's drawn box by 2^-16 of its distance from the origin, which is far coarser than float32 precision          | packages/core/src/canvas/nodeShapes/strokedBounds.ts:67 (flattenFor, FINEST)                                                                              |    15 |     0 |      1 | medium   |
| D15 | kit:shape draws data.sides/points unrounded and unclamped, so its path disagrees with the shape generator's counts                             | packages/core/src/canvas/nodeShapes/shapePainter.ts:107 (pathForShape)                                                                                    |    17 |     0 |      4 | medium   |
| D16 | strokedBounds tessellates an infinite stroke width instead of returning null                                                                   | packages/core/src/canvas/nodeShapes/strokedBounds.ts:26 (strokedBounds)                                                                                   |    17 |     0 |      2 | low      |
| D17 | A group's drawn bounds omit the marker heads on its border.                                                                                    | packages/core/src/canvas/nodeShapes/groupBoxPainter.ts:62 (groupBoxDrawnBounds)                                                                           |    18 |     0 |      1 | low      |
| D18 | hasStroke reports an infinite-width stroke as drawn, though the renderer refuses to draw it.                                                   | packages/core/src/canvas/nodeShapes/nodePaint.ts:140 (hasStroke)                                                                                          |    18 |     0 |      3 | low      |
| D19 | A polygon or star on a mirrored pose is drawn unmirrored                                                                                       | packages/core/src/canvas/nodeShapes/shapePainter.ts:98 (pathForShape)                                                                                     |    20 |     0 |      1 | low      |
