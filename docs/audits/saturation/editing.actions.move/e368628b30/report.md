# editing.actions.move: saturation

Repeated blind reviews of the area `editing.actions.move` (33 files) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, or 40 occasions have run.
Not stopped yet. `skulkr saturate report editing.actions.move` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.16 |    $0.08 |     0.1 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        2 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        2 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                                      | where                                                         | first | codex | severity |
|-----|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------|------:|------:|----------|
| D1  | Layout exit detection falls back to the pose's unrotated axis-aligned bounds for rotated containers without a contains callback, misclassifying releases inside/outside the drawn container | packages/editing/src/actions/move/layout/exits.ts:32          |     1 |     1 | medium   |
| D2  | Swap dwell timer callback arms the captured target ID without rechecking that the node still exists or is eligible, previewing an absent target                                             | packages/editing/src/actions/move/behaviors/swapOnDrop.ts:133 |     1 |     1 | low      |
