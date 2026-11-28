# geom.paths.part1: saturation

Repeated blind reviews of the area `geom.paths.part1` (38 files, 5706 lines) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: fewer than 1 defect per thousand lines estimated unseen (0.58). The next defect should cost about $2.09. `skulkr scour report geom.paths.part1` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.17 |    $0.06 |     0.1 |
|   2 | claude |        5 |   5 |        8 |   8 |   0 |       22.0 |   14.0 |   100.0% | $1.97 |    $0.27 |     3.7 |
|   3 | claude |        4 |   1 |        9 |   6 |   3 |       13.0 |    4.0 |    33.3% | $0.99 |    $0.35 |     3.8 |
|   4 | claude |        5 |   3 |       12 |   7 |   5 |       15.7 |    3.7 |    27.9% | $2.08 |    $0.43 |     4.6 |
|   5 | claude |        6 |   0 |       12 |   5 |   3 |       15.3 |    3.3 |    16.7% | $2.30 |    $0.63 |     4.5 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        3 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |        9 |        9.5 |    0.5 |     5.0% |       – |
| all sources    | Chao2     |         5 |       12 |       15.3 |    3.3 |    16.7% |       – |
| codex × claude | Chapman   |         – |       12 |       39.0 |   27.0 |        – |       0 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                           | where                                                                            | first | codex | claude | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | A fractional anchor index is accepted and splice truncates it, deleting a real anchor the caller did not identify                                | packages/geom/src/paths/anchorEdits.ts:51                                        |     1 |     1 |      0 | medium   |
| D2  | Symmetry detection pairs anchor coordinates and handles without checking adjacency or endpoints, so it accepts a path whose edges are asymmetric | packages/geom/src/paths/anchorSymmetry.ts:49                                     |     1 |     1 |      0 | medium   |
| D3  | A non-finite sides count (Infinity) leaves the regular polygon/star vertex loop with no finite stop, allocating without end                      | packages/geom/src/paths/builder.ts:254                                           |     1 |     1 |      0 | medium   |
| D4  | writeAnchorField under syms applies a `by` handle entry twice when an anchor and its mirror image are both selected                              | packages/geom/src/paths/anchorFields.ts:93 (writeAnchorField)                    |     2 |     0 |      3 | medium   |
| D5  | offsetCornerTraces builds its probe wedge without an origin, so traces lose float32 precision far from 0                                         | packages/geom/src/paths/cornerOffset.ts:46 (offsetCornerTraces)                  |     2 |     0 |      3 | medium   |
| D6  | offsetCornerTraces resizes from the stored radius rather than the clamped cut the corner actually draws                                          | packages/geom/src/paths/cornerOffset.ts:40 (offsetCornerTraces)                  |     2 |     0 |      2 | low      |
| D7  | restoreCorners drops a corner spec stored on a closed contour's twin anchor                                                                      | packages/geom/src/paths/cornerRestore.ts:239 (restoreCorners)                    |     2 |     0 |      3 | low      |
| D8  | nearestOpenEnds ignores lone anchors that subpathEndAt and joinSubpathEnds treat as joinable ends                                                | packages/geom/src/paths/joinAnchors.ts:139 (nearestOpenEnds)                     |     2 |     0 |      1 | low      |
| D9  | bendSegmentSymmetric throws when a grip names a subpath past the end, where bendSegment returns false                                            | packages/geom/src/paths/anchorSymmetry.ts:213 (flatOf, via bendSegmentSymmetric) |     3 |     0 |      3 | low      |
| D10 | outsideSide divides by a zero tangent, sending windingOf into a 2^40-deep recursion                                                              | packages/geom/src/paths/contourSides.ts:52 (outsideSide)                         |     4 |     0 |      1 | medium   |
| D11 | boundsOfPaths pulls the union out to (0, 0) whenever the set contains an empty path                                                              | packages/geom/src/paths/boundsOfPaths.ts:18 (boundsOfPaths)                      |     4 |     0 |      2 | low      |
| D12 | anchorsToPath re-encodes far-moved anchors in float32 when `like` has no origin, losing precision                                                | packages/geom/src/paths/anchors.ts:178 (anchorsToPath)                           |     4 |     0 |      2 | low      |
