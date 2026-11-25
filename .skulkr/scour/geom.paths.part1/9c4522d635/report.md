# geom.paths.part1: saturation

Repeated blind reviews of the area `geom.paths.part1` (38 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, or 40 occasions have run.
Not stopped yet. `skulkr saturate report geom.paths.part1` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.17 |    $0.06 |     0.1 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        3 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        3 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                           | where                                        | first | codex | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------|------:|------:|----------|
| D1  | A fractional anchor index is accepted and splice truncates it, deleting a real anchor the caller did not identify                                | packages/geom/src/paths/anchorEdits.ts:51    |     1 |     1 | medium   |
| D2  | Symmetry detection pairs anchor coordinates and handles without checking adjacency or endpoints, so it accepts a path whose edges are asymmetric | packages/geom/src/paths/anchorSymmetry.ts:49 |     1 |     1 | medium   |
| D3  | A non-finite sides count (Infinity) leaves the regular polygon/star vertex loop with no finite stop, allocating without end                      | packages/geom/src/paths/builder.ts:254       |     1 |     1 | medium   |
