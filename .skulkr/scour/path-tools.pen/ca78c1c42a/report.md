# path-tools.pen: saturation

Repeated blind reviews of the area `path-tools.pen` (12 files, 1262 lines) at the frozen commit
`ca78c1c42a`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report path-tools.pen` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.17 |    $0.09 |     0.2 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        2 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        2 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                   | where                                                                | first | codex | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------|------:|------:|----------|
| D1  | Closing a pen path with a handle drag passes empty onEnd deps to closeCurrent, so the commit inserts nothing and the drawing (or pending continuation edit) is discarded | packages/path-tools/src/pen/penActions.ts:204 (onEnd closing branch) |     1 |     1 | medium   |
| D2  | A refused continuation join still deletes the other path, because commitJoin appends its delete op even when editOps is empty                                            | packages/path-tools/src/pen/penJoin.ts:70 (commitJoin)               |     1 |     1 | high     |
