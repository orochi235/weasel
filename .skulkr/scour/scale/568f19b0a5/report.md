# scale: saturation

Repeated blind reviews of the area `scale` (12 files, 883 lines) at the frozen commit
`568f19b0a5`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report scale` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.24 |    $0.08 |     0.2 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        3 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        3 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                     | where                                      | first | codex | severity |
|-----|------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------|------:|------:|----------|
| D1  | Inverse mapping divides by the raw range difference, which overflows on a wide finite range: the midpoint inverts to domain[0] and the far endpoint to NaN | packages/scale/src/linear.ts:170           |     1 |     1 | medium   |
| D2  | onGrid sets decimal places from the step's magnitude, so a step of 0.25 rounds 0.75 to 0.8 and stepTicks returns ticks off the grid or out of bounds       | packages/scale/src/linear.ts:72 (onGrid)   |     1 |     1 | medium   |
| D3  | The log scale constructor builds the full unthinned powerTicks array only to test whether it has two entries, which blows up for a base near 1             | packages/scale/src/log.ts:59 (constructor) |     1 |     1 | medium   |
