# diagram.effect.part1: saturation

Repeated blind reviews of the area `diagram.effect.part1` (31 files, 3497 lines) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 6.0 known defects per thousand lines, at least 5. The next defect should cost about $1.87. `skulkr scour report diagram.effect.part1` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.16 |    $0.08 |     0.1 |
|   2 | claude |        1 |   1 |        3 |   3 |   0 |        4.5 |    1.5 |   100.0% | $1.55 |    $0.57 |     4.2 |
|   3 | claude |        2 |   2 |        5 |   5 |   0 |       11.7 |    6.7 |   100.0% | $1.33 |    $0.61 |     5.3 |
|   4 | claude |        1 |   1 |        6 |   6 |   0 |       17.3 |   11.3 |   100.0% | $0.97 |    $0.67 |     3.3 |
|   5 | claude |        2 |   2 |        8 |   8 |   0 |       30.4 |   22.4 |   100.0% | $1.71 |    $0.72 |     6.4 |
|   6 | claude |        1 |   0 |        8 |   7 |   1 |       28.4 |   20.4 |    73.6% | $0.90 |    $0.83 |     3.4 |
|   7 | claude |        4 |   4 |       12 |  11 |   1 |       63.9 |   51.9 |    82.1% | $1.26 |    $0.66 |     4.3 |
|   8 | claude |        3 |   2 |       14 |  12 |   2 |       45.5 |   31.5 |    71.6% | $1.73 |    $0.69 |     6.6 |
|   9 | claude |        1 |   0 |       14 |  11 |   3 |       31.9 |   17.9 |    60.6% | $0.81 |    $0.74 |     3.3 |
|  10 | claude |        4 |   4 |       18 |  15 |   3 |       51.8 |   33.8 |    68.4% | $1.40 |    $0.66 |     5.8 |
|  11 | claude |        2 |   0 |       18 |  14 |   3 |       47.7 |   29.7 |    58.4% | $1.22 |    $0.72 |     4.8 |
|  12 | claude |        3 |   1 |       19 |  14 |   4 |       41.5 |   22.5 |    51.2% | $1.08 |    $0.74 |     4.1 |
|  13 | claude |        1 |   0 |       19 |  13 |   5 |       34.6 |   15.6 |    45.2% | $0.95 |    $0.79 |     3.5 |
|  14 | claude |        4 |   2 |       21 |  15 |   3 |       55.8 |   34.8 |    46.9% | $1.07 |    $0.77 |     4.8 |
|  15 | claude |        1 |   0 |       21 |  15 |   2 |       73.5 |   52.5 |    46.0% | $0.82 |    $0.81 |     3.4 |
|  16 | claude |        2 |   0 |       21 |  14 |   3 |       51.6 |   30.6 |    40.0% | $1.05 |    $0.86 |     4.6 |
|  17 | claude |        1 |   0 |       21 |  14 |   3 |       51.7 |   30.7 |    39.0% | $1.26 |    $0.92 |     4.8 |
|  18 | claude |        3 |   0 |       21 |  12 |   5 |       34.6 |   13.6 |    30.1% | $1.34 |    $0.98 |     4.8 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |        17 |       20 |       36.9 |   16.9 |    32.0% |       – |
| all sources    | Chao2     |        18 |       21 |       34.6 |   13.6 |    30.1% |       – |
| codex × claude | Chapman   |         – |       21 |       30.5 |    9.5 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                | where                                                                                                                                            | first | codex | claude | severity |
|-----|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Recovering from a failed setter in a multi-parameter update re-applies the setters that already succeeded, so each runs twice                                         | packages/diagram/src/effect/audio/liveRunner.ts:68 (applySets)                                                                                   |     1 |     1 |      0 | medium   |
| D2  | A partially failed graph start leaves the healthy sources playing while the runner's state stays paused                                                               | packages/diagram/src/effect/audio/liveRunner.ts:255                                                                                              |     1 |     1 |      1 | medium   |
| D3  | nextStageId mints an id a cluster already has, so adding a stage makes that cluster vanish                                                                            | packages/diagram/src/effect/edit.ts:17 (nextStageId)                                                                                             |     2 |     0 |      3 | medium   |
| D4  | moveRunInChain picks a moved run's unwired main port without regard to type or control, refusing valid moves                                                          | packages/diagram/src/effect/chainEdit.ts:85 (moveRunInChain)                                                                                     |     3 |     0 |      1 | low      |
| D5  | clusterContents and clusterParents disagree with how clusters are drawn when a member is named twice or clusters loop                                                 | packages/diagram/src/effect/clusterEdit.ts:150 (clusterContents), clusterEdit.ts:44 (clusterParents)                                             |     3 |     0 |      1 | low      |
| D6  | canConnect counts an id-less or repeated-id wire as feeding its own input while its end is dragged                                                                    | packages/diagram/src/effect/editorHandlers.ts:96 (editHandlers → canConnect)                                                                     |     4 |     0 |      4 | medium   |
| D7  | Live audio previews always land on port `out` regardless of the stage's actual output port name                                                                       | packages/diagram/src/effect/audio/livePreviews.ts:73 (createLivePreviews → draw)                                                                 |     5 |     0 |      1 | low      |
| D8  | A bypassed stage whose ports are not typed `audio` cuts the signal instead of passing it through                                                                      | packages/diagram/src/effect/audio/plan.ts:73 (livePlan)                                                                                          |     5 |     0 |      1 | low      |
| D9  | A wire id equal to a stage id (or a minted id colliding across the wire and stage namespaces) makes diagramScene throw, and checkPipeline never reports the collision | packages/diagram/src/effect/edit.ts:20 (nextWireId), edit.ts:15 (nextStageId), packages/diagram/src/effect/check.ts:98 (checkPipeline wire loop) |     7 |     0 |      2 | medium   |
| D10 | Reordering lanes drops every laneOrder entry whose type has no stage yet                                                                                              | packages/diagram/src/effect/editorReorder.ts:117 (laneMove)                                                                                      |     7 |     0 |      1 | low      |
| D11 | An edit that changes the errors while paused wipes the previews already drawn, and they stay blank until play                                                         | packages/diagram/src/effect/audio/liveRunner.ts:226 (publishErrors), liveRunner.ts:271 (frame)                                                   |     7 |     0 |      5 | low      |
| D12 | checkPipeline does not report a cluster that names the same member twice                                                                                              | packages/diagram/src/effect/check.ts:138 (checkPipeline, duplicate-member)                                                                       |     7 |     0 |      4 | low      |
| D13 | Live audio runner draws every scope and spectrum at the default 48-unit size, ignoring the look's previewSize                                                         | packages/diagram/src/effect/audio/livePreviews.ts:74 (createLivePreviews → draw)                                                                 |     8 |     0 |      1 | low      |
| D14 | A structural batch the graph refuses blocks every param write in that sync and every later sync until the structure changes                                           | packages/diagram/src/effect/audio/liveRunner.ts:237 (createLiveAudioRunner → sync)                                                               |     8 |     0 |      1 | low      |
| D15 | clusterStages deletes a boxed cluster it empties, whereas moveToCluster keeps it                                                                                      | packages/diagram/src/effect/clusterEdit.ts:93 (clusterStages)                                                                                    |    10 |     0 |      2 | low      |
| D16 | Renaming a cluster whose label has leading or trailing spaces records a 'Rename group' edit when nothing changed                                                      | packages/diagram/src/effect/clusterTitle.tsx:44 (useClusterTitle done)                                                                           |    10 |     0 |      1 | low      |
| D17 | Clearing a route that does not exist still sends an 'Edit route' edit under nodeGraph                                                                                 | packages/diagram/src/effect/editorHandlers.ts:111 (editHandlers onEditRoute)                                                                     |    10 |     0 |      1 | low      |
| D18 | The cluster reorder counts order items that have no drawn box as drawn, while the stage reorder drops them                                                            | packages/diagram/src/effect/editorReorder.ts:136 (clusterReorder moved)                                                                          |    10 |     0 |      2 | low      |
| D19 | checkPipeline does not report two wires feeding an input that does not accept many                                                                                    | packages/diagram/src/effect/check.ts:96 (checkPipeline, wire loop)                                                                               |    12 |     0 |      1 | low      |
| D20 | typeColors uses up a series color for every type that already has its own color, so later types get shifted colors                                                    | packages/diagram/src/effect/draw.ts:73 (typeColors)                                                                                              |    14 |     0 |      1 | low      |
| D21 | A delay node's maximum delay time is fixed when it is built, so a time later raised as a level past that maximum is not honored                                       | packages/diagram/src/effect/audio/nodes.ts:87 ('audio.delay')                                                                                    |    14 |     0 |      2 | low      |
