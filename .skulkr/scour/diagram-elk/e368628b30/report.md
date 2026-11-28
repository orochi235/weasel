# diagram-elk: saturation

Repeated blind reviews of the area `diagram-elk` (4 files, 520 lines) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 21.2 known defects per thousand lines, at least 5. The next defect should cost about $0.52. `skulkr scour report diagram-elk` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.16 |    $0.08 |     0.2 |
|   2 | claude |        1 |   1 |        3 |   3 |   0 |        4.5 |    1.5 |   100.0% | $1.03 |    $0.40 |     2.1 |
|   3 | claude |        3 |   3 |        6 |   6 |   0 |       16.0 |   10.0 |   100.0% | $1.01 |    $0.37 |     2.1 |
|   4 | claude |        4 |   3 |        9 |   8 |   1 |       33.0 |   24.0 |    73.8% | $0.80 |    $0.33 |     1.3 |
|   5 | claude |        4 |   2 |       11 |   9 |   1 |       43.4 |   32.4 |    60.9% | $1.09 |    $0.37 |     2.0 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |       10 |       22.0 |   12.0 |    57.1% |       – |
| all sources    | Chao2     |         5 |       11 |       43.4 |   32.4 |    60.9% |       – |
| codex × claude | Chapman   |         – |       11 |       15.5 |    4.5 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                             | where                                                                                                                                                           | first | codex | claude | severity |
|-----|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | A user elk.json.shapeCoords=PARENT override replaces ROOT while fromElk still treats child coordinates as absolute, misplacing nested nodes                                        | packages/diagram-elk/src/elkPlan.ts:77                                                                                                                          |     1 |     1 |      2 | medium   |
| D2  | Multi-section ELK edges are concatenated in array order instead of following section links, yielding backwards segments and wrong endpoints                                        | packages/diagram-elk/src/fromElk.ts:44                                                                                                                          |     1 |     1 |      0 | medium   |
| D3  | A centered edge label (offset 0) is given ELK room beside its wire, but the diagram draws it centered on the wire, so the reserved space and the drawn label disagree              | packages/diagram-elk/src/toElk.ts:174 (labelRoom)                                                                                                               |     2 |     0 |      1 | medium   |
| D4  | Authored edges are passed to ELK as ordinary edges, so ELK reserves rank and label room for them, unlike the layered layout                                                        | packages/diagram-elk/src/toElk.ts:106 (toElk, elkEdges map)                                                                                                     |     3 |     0 |      1 | medium   |
| D5  | nodeGap, rankGap and the node-placement strategy are set only on the root, so ELK falls back to its own defaults inside clusters                                                   | packages/diagram-elk/src/toElk.ts:162 (clusterOptions); packages/diagram-elk/src/elkPlan.ts:64 (elkRootOptions)                                                 |     3 |     0 |      1 | medium   |
| D6  | minimumTransposed swaps a cluster's minimum width for every algorithm, not only layered                                                                                            | packages/diagram-elk/src/toElk.ts:192 (minimumTransposed)                                                                                                       |     3 |     0 |      1 | low      |
| D7  | ELK lays out each node at its bare bounds and ignores GraphNode.margin                                                                                                             | packages/diagram-elk/src/toElk.ts:137 (leafOf)                                                                                                                  |     4 |     0 |      1 | medium   |
| D8  | A direction given in elkOptions by ELK's short suffix id is missed by the label-room and minimum-size logic                                                                        | packages/diagram-elk/src/toElk.ts:181 (crossAxis), packages/diagram-elk/src/toElk.ts:188 (minimumTransposed), packages/diagram-elk/src/elkPlan.ts:81 (shortIds) |     4 |     0 |      2 | low      |
| D9  | elkPlanner(opts) lets an option passed explicitly as undefined erase the run's value for it                                                                                        | packages/diagram-elk/src/elkPlan.ts:126 (elkPlanner)                                                                                                            |     4 |     0 |      1 | low      |
| D10 | The direction is compared case-sensitively, but ELK reads enum values case-insensitively, so a direction like 'down' or 'Right' is missed by the label-room and minimum-size logic | packages/diagram-elk/src/toElk.ts:187 (crossAxis), packages/diagram-elk/src/toElk.ts:195 (minimumTransposed)                                                    |     5 |     0 |      1 | low      |
| D11 | elkPlanner drops the run's order, so a live re-layout does not keep the seeded order                                                                                               | packages/diagram-elk/src/elkPlan.ts:119 (elkPlanner)                                                                                                            |     5 |     0 |      1 | low      |
