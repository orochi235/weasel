# stroke: saturation

Repeated blind reviews of the area `stroke` (31 files, 3497 lines) at the frozen commit
`568f19b0a5`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report stroke` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        4 |   4 |        4 |   4 |   0 |          – |      – |        – | $0.25 |    $0.06 |     0.2 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        4 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        4 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                  | where                                       | first | codex | severity |
|-----|-------------------------------------------------------------------------------------------------------------------------|---------------------------------------------|------:|------:|----------|
| D1  | Stroke-edge query ignores stroke.trim, reporting edges on trimmed-away sections and when nothing is drawn               | packages/stroke/src/strokeEdge.ts:72        |     1 |     1 | medium   |
| D2  | Metric normalization yields NaN when squaring a large anisotropic coefficient overflows while the determinant is finite | packages/stroke/src/tessellate/metric.ts:69 |     1 |     1 | low      |
| D3  | A large finite uniform similarity overflows the determinant and is reported singular                                    | packages/stroke/src/tessellate/metric.ts:69 |     1 |     1 | low      |
| D4  | Absolute 1e-9 segment tolerance makes short dashed paths with proportionally short patterns lose their gaps             | packages/stroke/src/tessellate/dash.ts:166  |     1 |     1 | low      |
