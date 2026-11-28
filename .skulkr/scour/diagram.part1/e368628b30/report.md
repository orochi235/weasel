# diagram.part1: saturation

Repeated blind reviews of the area `diagram.part1` (39 files, 5392 lines) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: the next defect would cost about $1.59, over the limit of $1.49 (3× the $0.50 going rate). The next defect should cost about $1.59. `skulkr scour report diagram.part1` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.16 |    $0.08 |     0.1 |
|   2 | claude |        3 |   3 |        5 |   5 |   0 |       10.0 |    5.0 |   100.0% | $2.16 |    $0.46 |     3.5 |
|   3 | claude |        3 |   2 |        7 |   6 |   1 |       19.0 |   12.0 |    64.3% | $0.81 |    $0.45 |     2.7 |
|   4 | claude |        3 |   2 |        9 |   7 |   2 |       18.2 |    9.2 |    53.5% | $1.22 |    $0.48 |     3.4 |
|   5 | claude |        4 |   2 |       11 |   8 |   2 |       23.8 |   12.8 |    47.4% | $0.92 |    $0.48 |     3.6 |
|   6 | claude |        3 |   2 |       13 |  10 |   1 |       54.7 |   41.7 |    53.4% | $1.39 |    $0.51 |     4.5 |
|   7 | claude |        4 |   2 |       15 |  11 |   1 |       66.9 |   51.9 |    48.5% | $1.33 |    $0.53 |     4.0 |
|   8 | claude |        2 |   1 |       16 |  12 |   1 |       79.0 |   63.0 |    48.8% | $0.86 |    $0.55 |     2.9 |
|   9 | claude |        3 |   1 |       17 |  11 |   3 |       34.9 |   17.9 |    38.1% | $1.24 |    $0.59 |     3.6 |
|  10 | claude |        4 |   1 |       18 |  10 |   4 |       29.3 |   11.3 |    29.6% | $1.98 |    $0.67 |     3.1 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |         9 |       16 |       23.1 |    7.1 |    24.5% |       – |
| all sources    | Chao2     |        10 |       18 |       29.3 |   11.3 |    29.6% |       – |
| codex × claude | Chapman   |         – |       18 |       50.0 |   32.0 |        – |       0 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                                                | where                                                                                                                     | first | codex | claude | severity |
|-----|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Deleting a region omits diagram descendants nested behind a plain group, since the reporting path recurses only through region children, so nested shapes and their attached connectors go unreported | packages/diagram/src/diagramEditing.ts:39                                                                                 |     1 |     1 |      0 | medium   |
| D2  | A queued batched edit is delivered to the latest onEdit callback rather than the one current when the edit was reported, misapplying it to a replaced document or dropping it                         | packages/diagram/src/batchedEdits.ts:35                                                                                   |     1 |     1 |      0 | low      |
| D3  | A data node's own colors.header / colors.headerText are missing from ownStyle, so a theme change overwrites them                                                                                      | packages/diagram/src/dataColors.ts:7 (NODE_FIELDS / ownNodeStyle)                                                         |     2 |     0 |      4 | medium   |
| D4  | relayoutBodies re-measures a row with no row node using the default style, so editing any other row changes that row's height                                                                         | packages/diagram/src/bodyRelayout.ts:117 (relayoutBodies)                                                                 |     2 |     0 |      2 | low      |
| D5  | A connect can glue to a body whose every port showsPort hides, so the edge routes to a hidden port                                                                                                    | packages/diagram/src/connectTargets.ts:189 (createResolver.landing), packages/diagram/src/connectTargets.ts:224 (portFor) |     2 |     0 |      3 | low      |
| D6  | A pool with no box nested in a boxed container gets no lane boxes, so its lanes vanish and its members have no seat                                                                                   | packages/diagram/src/dataContainerPlace.ts:76 (placeContainers)                                                           |     3 |     0 |      1 | medium   |
| D7  | A bounded view's limits come from the specs' poses rather than where a live layout moved the nodes                                                                                                    | packages/diagram/src/DiagramView.tsx:118 (Inner, viewBounds)                                                              |     3 |     0 |      3 | medium   |
| D8  | Layered and tree layouts reserve no room for a cluster's minWidth when ranks run along x, so a titled cluster's box overlaps the next rank                                                            | packages/diagram/src/cluster.ts:95 (rankGaps), packages/diagram/src/cluster.ts:340 (widen)                                |     4 |     0 |      1 | medium   |
| D9  | DiagramViewApi.fit() and a settled layout fit against a 0 × 0 box while a filling view is still unmeasured                                                                                            | packages/diagram/src/diagramFit.ts:150 (useDiagramFit now, settle, fitNow)                                                |     4 |     0 |      1 | low      |
| D10 | useDiagramFit's defaultView memo omits fit.bounds from its deps, so the opening fit stays clamped to stale bounds                                                                                     | packages/diagram/src/diagramFit.ts:127 (useDiagramFit, defaultView memo deps)                                             |     5 |     0 |      1 | low      |
| D11 | clusterBoxes wraps a cluster's box around its members' bare boxes, while CLUSTER_DERIVE_POSE grows each member by its margin, so the box and the members' margins disagree                            | packages/diagram/src/dataClusters.ts:105 (clusterBoxes)                                                                   |     5 |     0 |      1 | low      |
| D12 | A pool box too small for its unsized lanes lets the lanes stack past the box                                                                                                                          | packages/diagram/src/dataContainers.ts:139 (laneSizes)                                                                    |     6 |     0 |      1 | low      |
| D13 | buildBody gives leaves world poses but also sets parent, so spreading them into a rigid scene offsets every row twice                                                                                 | packages/diagram/src/buildBody.ts:78 (buildBody, leaf)                                                                    |     6 |     0 |      2 | low      |
| D14 | startFrom: 'body' starts a connect from a body with no ports, which landing refuses as a target                                                                                                       | packages/diagram/src/connect.ts:279 (createConnectAction › startEnd)                                                      |     7 |     0 |      3 | medium   |
| D15 | relayoutBodies measures a field row differently from the build, dropping its room                                                                                                                     | packages/diagram/src/bodyRelayout.ts:119 (relayoutBodies)                                                                 |     7 |     0 |      1 | low      |
| D16 | DiagramViewApi.worldAt returns client coordinates as world coordinates when the canvas is not mounted                                                                                                 | packages/diagram/src/DiagramView.tsx:256 (useDiagramApi, worldAt)                                                         |     8 |     0 |      2 | low      |
| D17 | A container stencil's ghost is drawn dashed, but the container it inserts is never dashed                                                                                                             | packages/diagram/src/StencilGhost.tsx:28 (StencilGhost)                                                                   |     9 |     0 |      2 | low      |
| D18 | A queued batched edit still calls onEdit after the view has unmounted, because the pending batch is not canceled on unmount                                                                           | packages/diagram/src/batchedEdits.ts:36 (useBatchedEdits → gather)                                                        |    10 |     0 |      1 | low      |
