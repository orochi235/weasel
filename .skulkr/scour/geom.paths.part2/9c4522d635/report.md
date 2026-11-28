# geom.paths.part2: saturation

Repeated blind reviews of the area `geom.paths.part2` (38 files, 5272 lines) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.97, or 40 occasions have run.
Stopped: the next defect would cost about $1.97, over the limit of $1.97 (4× the $0.49 going rate). The next defect should cost about $1.97. `skulkr scour report geom.paths.part2` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.16 |    $0.08 |     0.1 |
|   2 | claude |        2 |   2 |        4 |   4 |   0 |        7.0 |    3.0 |   100.0% | $2.05 |    $0.55 |     3.9 |
|   3 | claude |        2 |   2 |        6 |   6 |   0 |       16.0 |   10.0 |   100.0% | $2.14 |    $0.72 |     4.5 |
|   4 | claude |        1 |   1 |        7 |   7 |   0 |       22.8 |   15.8 |   100.0% | $1.95 |    $0.90 |     7.0 |
|   5 | claude |        3 |   2 |        9 |   8 |   1 |       34.6 |   25.6 |    75.3% | $1.89 |    $0.91 |     3.9 |
|   6 | claude |        2 |   1 |       10 |   9 |   0 |       40.0 |   30.0 |    75.0% | $1.01 |    $0.92 |     3.6 |
|   7 | claude |        1 |   0 |       10 |   8 |   1 |       37.4 |   27.4 |    59.1% | $1.53 |    $1.07 |     5.5 |
|   8 | claude |        2 |   1 |       11 |   9 |   1 |       46.4 |   35.4 |    58.2% | $1.23 |    $1.09 |     4.6 |
|   9 | claude |        1 |   0 |       11 |   9 |   1 |       47.0 |   36.0 |    54.7% | $0.87 |    $1.17 |     3.3 |
|  10 | claude |        3 |   2 |       13 |  11 |   0 |       62.5 |   49.5 |    57.9% | $1.10 |    $1.07 |     4.5 |
|  11 | claude |        1 |   1 |       14 |  12 |   0 |       74.0 |   60.0 |    60.0% | $1.10 |    $1.07 |     3.9 |
|  12 | claude |        2 |   1 |       15 |  13 |   0 |       86.5 |   71.5 |    59.1% | $1.95 |    $1.13 |     7.6 |
|  13 | claude |        3 |   1 |       16 |  13 |   1 |       94.0 |   78.0 |    51.3% | $1.54 |    $1.16 |     5.8 |
|  14 | claude |        1 |   0 |       16 |  12 |   2 |       49.4 |   33.4 |    45.0% | $0.83 |    $1.21 |     2.4 |
|  15 | claude |        1 |   1 |       17 |  13 |   1 |       95.9 |   78.9 |    45.9% | $1.14 |    $1.20 |     4.4 |
|  16 | claude |        1 |   1 |       18 |  14 |   1 |      109.9 |   91.9 |    47.8% | $0.89 |    $1.19 |     3.1 |
|  17 | claude |        2 |   2 |       20 |  16 |   1 |      140.5 |  120.5 |    51.2% | $2.23 |    $1.18 |     4.6 |
|  18 | claude |        4 |   2 |       22 |  15 |   4 |       48.6 |   26.6 |    40.4% | $2.04 |    $1.17 |     4.6 |
|  19 | claude |        3 |   1 |       23 |  16 |   2 |       83.6 |   60.6 |    40.5% | $1.38 |    $1.17 |     4.7 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |        18 |       21 |       67.3 |   46.3 |    37.2% |       – |
| all sources    | Chao2     |        19 |       23 |       83.6 |   60.6 |    40.5% |       – |
| codex × claude | Chapman   |         – |       23 |       65.0 |   42.0 |        – |       0 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                               | where                                                                                                                        | first | codex | claude | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Identity affine fast path adds width to the translated x before differencing, so a rect at x=2**54 with width 1 comes out with width 0                                               | packages/geom/src/paths/transformPath.ts:23                                                                                  |     1 |     1 |      0 | low      |
| D2  | Synthesizing the move for an implicit subpath after close spreads the entire command and coordinate streams into constructor calls, throwing past the argument limit on large inputs | packages/geom/src/paths/splitSubpaths.ts:35 (placeSubpaths)                                                                  |     1 |     1 |      0 | medium   |
| D3  | mergeRegion's welder can map the same point to two different welded points, so a contour's last end and first start come apart                                                       | packages/geom/src/paths/mergeRegion.ts:233 (welder)                                                                          |     2 |     0 |      1 | low      |
| D4  | roundRectPath writes duplicate consecutive points when the radius is half a side (pill shapes)                                                                                       | packages/geom/src/paths/markers.ts:79 (roundRectPath)                                                                        |     2 |     0 |      5 | low      |
| D5  | reachToMeet finds the crossing on one cubic approximation of the arc but places the end on another, so the end lands off the stroke                                                  | packages/geom/src/paths/reachPath.ts:96 (reachToMeet)                                                                        |     3 |     0 |      1 | low      |
| D6  | resamplePath with a NaN tolerance halves every piece down to the subdivision limit                                                                                                   | packages/geom/src/paths/resamplePath.ts:58 (resamplePath)                                                                    |     3 |     0 |      2 | low      |
| D7  | pathToD writes no moveto for a subpath that opens without one, so its output draws nothing                                                                                           | packages/geom/src/paths/pathToD.ts:28 (pathToD)                                                                              |     4 |     0 |      5 | low      |
| D8  | splitSubpaths omits the implied moveto when the path's first subpath opens without one                                                                                               | packages/geom/src/paths/splitSubpaths.ts:46 (placeSubpaths)                                                                  |     5 |     0 |      1 | low      |
| D9  | reachToMeet and extensionPieces use different tests for a straight 'curvature' end, so a near-straight end with no maxDistance extends as a huge full circle                         | packages/geom/src/paths/reachPath.ts:96 (reachToMeet)                                                                        |     5 |     0 |      3 | medium   |
| D10 | zigzagPath never pushes the leading points when a contour starts on a zero-length segment                                                                                            | packages/geom/src/paths/zigzagPath.ts:36 (zigzagPath)                                                                        |     6 |     0 |      1 | low      |
| D11 | reachToMeet skips crossings with the end's own last segment, so a reach that meets that segment finds no crossing                                                                    | packages/geom/src/paths/reachPath.ts:42 (segmentsBesideEnd)                                                                  |     8 |     0 |      3 | low      |
| D12 | tweenPaths drops a contour that has no segments on one side, so at(1) is not the second shape                                                                                        | packages/geom/src/paths/tweenPaths.ts:139 (subdivideTo), :218 (lerpContour)                                                  |    10 |     0 |      1 | low      |
| D13 | simplifyPath leaves a duplicate seam anchor on a closed subpath when its last corner-to-corner run collapses to one point                                                            | packages/geom/src/paths/simplifyPath.ts:121 (fitStops)                                                                       |    10 |     0 |      1 | low      |
| D14 | tugPathEnd keeps the end anchor's dangling handle on a straight extension piece, so the straight run comes out curved                                                                | packages/geom/src/paths/tugPathEnd.ts:205 (appendPieces)                                                                     |    11 |     0 |      1 | low      |
| D15 | mergeRegion runs quadratically in segment count: overlapCuts tests every segment pair and filledSide computes a full winding for each piece                                          | packages/geom/src/paths/mergeRegion.ts:92 (overlapCuts), :325 (filledSide → winding)                                         |    12 |     0 |      1 | low      |
| D16 | pathInWorld can return the input Path instance instead of the fresh Path it promises                                                                                                 | packages/geom/src/paths/pathInWorld.ts:63 (pathInWorld)                                                                      |    13 |     0 |      1 | low      |
| D17 | Curvature-mode tug tests a straight end with curvature === 0 while the extension uses a turn threshold, so a near-straight end is handled inconsistently                             | packages/geom/src/paths/tugPathEnd.ts:96 (lengthToward)                                                                      |    15 |     0 |      1 | low      |
| D18 | pathFromD draws the path after an unknown leading command instead of drawing nothing                                                                                                 | packages/geom/src/paths/pathFromD.ts:68 (pathFromD)                                                                          |    16 |     0 |      3 | low      |
| D19 | An out-of-range number in non-arc path data is dropped and the following arguments slide into its slot                                                                               | packages/geom/src/paths/pathData.ts:63 (readNumbers)                                                                         |    17 |     0 |      1 | low      |
| D20 | pointAlongPath with t = NaN returns a NaN station instead of a clamped one                                                                                                           | packages/geom/src/paths/pathAt.ts:33 (pointAlongPath)                                                                        |    17 |     0 |      2 | low      |
| D21 | simplifyPath with a NaN tolerance drops straight segments                                                                                                                            | packages/geom/src/paths/simplifyPath.ts:105 (fitParams)                                                                      |    18 |     0 |      1 | low      |
| D22 | simplifySpan returns one anchor for a run of coincident anchors, so simplifyAnchorsAt deletes the run's last anchor                                                                  | packages/geom/src/paths/simplifyPath.ts:97 (simplifySpan); packages/geom/src/paths/simplifyAnchors.ts:47 (simplifyAnchorsAt) |    18 |     0 |      1 | low      |
| D23 | resamplePath's 10,000-anchor cap on spacing counts pieces rather than anchors, so the cap does not limit anchors as intended                                                         | packages/geom/src/paths/resamplePath.ts:121 (allocate)                                                                       |    19 |     0 |      1 | low      |
