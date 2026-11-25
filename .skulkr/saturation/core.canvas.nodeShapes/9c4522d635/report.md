# core.canvas.nodeShapes: saturation

Repeated blind reviews of the area `core.canvas.nodeShapes` (12 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, or 40 occasions have run.
Not stopped yet. `skulkr scour report core.canvas.nodeShapes` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.14 |    $0.07 |     0.2 |
|   2 | claude |        3 |   3 |        5 |   5 |   0 |       10.0 |    5.0 |   100.0% | $0.80 |    $0.19 |     2.2 |
|   3 | claude |        2 |   1 |        6 |   5 |   1 |       14.3 |    8.3 |    59.5% | $0.92 |    $0.31 |     2.6 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        2 |          – |      – |        – |       – |
| claude         | Chao2     |         2 |        4 |        6.3 |    2.3 |    36.0% |       – |
| all sources    | Chao2     |         3 |        6 |       14.3 |    8.3 |    59.5% |       – |
| codex × claude | Chapman   |         – |        6 |       14.0 |    8.0 |        – |       0 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                         | where                                                                           | first | codex | claude | severity |
|-----|------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | A non-finite legacy polygon sides or star points count reaches the builder unvalidated and its vertex loop never ends, stalling painting       | packages/core/src/canvas/nodeShapes/shapePainter.ts:99                          |     1 |     1 |      0 | medium   |
| D2  | Bounds ignore animated trim, so a square-capped smooth shape's cap overhang falls outside the reported drawn box                               | packages/core/src/canvas/nodeShapes/shapePainter.ts:73                          |     1 |     1 |      0 | medium   |
| D3  | strokedBounds includes the stroke ribbon for a stroke with no paint that only draws marker heads, overstating bounds                           | packages/core/src/canvas/nodeShapes/strokedBounds.ts:30 (strokedBounds)         |     2 |     0 |      2 | –        |
| D4  | A group's box border bounds use a uniform outset, disagreeing with kit:shape's measurement of the same rect when its stroke protrudes          | packages/core/src/canvas/nodeShapes/groupBoxPainter.ts:61 (groupBoxDrawnBounds) |     2 |     0 |      1 | –        |
| D5  | FRAMED pick cache keyed on pose identity picks against a stale outline when a pose buffer is mutated in place                                  | packages/core/src/canvas/nodeShapes/derivedPainter.ts:29 (framedPart)           |     2 |     0 |      1 | –        |
| D6  | hasStroke duplicates strokeHasInk but omits its non-finite-dash test, so the two disagree on whether a stroke with a non-finite dash draws ink | packages/core/src/canvas/nodeShapes/nodePaint.ts:136 (hasStroke)                |     3 |     0 |      1 | –        |
