# path-tools.part2: saturation

Repeated blind reviews of the area `path-tools.part2` (37 files, 3279 lines) at the frozen commit
`ca78c1c42a`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report path-tools.part2` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.18 |    $0.06 |     0.3 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        3 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        3 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                  | where                                                     | first | codex | severity |
|-----|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------|------:|------:|----------|
| D1  | Cut pieces borrow per-anchor data from another contour at a crossing because the new endpoint is projected onto the whole original path and ties keep the first command | packages/path-tools/src/pathCommands/pieceOrigins.ts:39   |     1 |     1 | medium   |
| D2  | Joining a default-width (omitted) stroke path to a retained path with base width 8 makes its NaN anchor widths resolve to 8 instead of 1                                | packages/path-tools/src/pathCommands/joinAnchorData.ts:72 |     1 |     1 | medium   |
| D3  | Shape Builder commit accepts fractional face indices and throws in merge mode on the undefined cut lookup                                                               | packages/path-tools/src/shapeBuilder/shapeBuilder.ts:66   |     1 |     1 | low      |
