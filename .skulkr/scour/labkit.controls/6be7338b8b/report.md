# labkit.controls: saturation

Repeated blind reviews of the area `labkit.controls` (38 files, 4682 lines) at the frozen commit
`6be7338b8b`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report labkit.controls` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.18 |    $0.06 |     0.2 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        3 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        3 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                     | where                                              | first | codex | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------|------:|------:|----------|
| D1  | A stale dialog callback from a canceled opening can write into a newly reopened draft because one shared open boolean guards every opening | packages/labkit/src/controls/DraftDialogRow.tsx:37 |     1 |     1 | medium   |
| D2  | Removing an open matrix cell's row or column from props leaves its editor open and able to write the removed cell's setting                | packages/labkit/src/controls/ControlMatrix.tsx:122 |     1 |     1 | medium   |
| D3  | Matrix popover Clear and Inherit buttons can write null or AUTO after the cell becomes disabled                                            | packages/labkit/src/controls/MatrixPopover.tsx:72  |     1 |     1 | medium   |
