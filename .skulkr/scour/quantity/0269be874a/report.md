# quantity: saturation

Repeated blind reviews of the area `quantity` (24 files, 3048 lines) at the frozen commit
`0269be874a`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report quantity` rewrites this file from the ledger.

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

| id  | defect                                                                                                                                        | where                                         | first | codex | severity |
|-----|-----------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------|------:|------:|----------|
| D1  | snapToStep returns NaN for a positive fine step (1e-21) because the twenty-place cap rounds the scaled step to zero and stepsFrom divides 0/0 | packages/quantity/src/spin.ts:43 (snapToStep) |     1 |     1 | low      |
| D2  | Duration formatting of a large finite value (Number.MAX_VALUE) overflows when scaled to tenths and renders Infinity/NaN components            | packages/quantity/src/kinds/measure.ts:129    |     1 |     1 | low      |
| D3  | Scale bar length computed through an affine toRoot difference collapses to zero pixels when the scope's offset is large (1e16)                | packages/quantity/src/scaleBar.ts:56          |     1 |     1 | low      |
