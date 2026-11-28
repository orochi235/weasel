# guides: saturation

Repeated blind reviews of the area `guides` (23 files) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report guides` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        1 |   1 |        1 |   1 |   0 |          – |      – |        – | $0.16 |    $0.16 |     0.1 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        1 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        1 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                        | where                                                                | first | codex | severity |
|-----|-----------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------|------:|------:|----------|
| D1  | Containment branch draws both gaps at the inner box's cross-axis midpoint, so marker endpoints can fall outside the outer box they measure to | packages/guides/src/spacingHints/distance.ts:65 (containment branch) |     1 |     1 | low      |
