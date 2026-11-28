# clock: saturation

Repeated blind reviews of the area `clock` (13 files) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report clock` rewrites this file from the ledger.

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

| id  | defect                                                                                                                                                        | where                           | first | codex | severity |
|-----|---------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------|------:|------:|----------|
| D1  | A rate reversal inside one frame integrates to zero displacement and misses the end of the run instead of stopping at the first endpoint reached              | packages/clock/src/clock.ts:176 |     1 |     1 | medium   |
| D2  | An external seek across a pass boundary leaves a hold active because the hold compares only elapsed, so a later span change snaps back to the old hold target | packages/clock/src/hold.ts:139  |     1 |     1 | low      |
| D3  | A tiny accepted duration (Number.MIN_VALUE) makes elapsed/duration overflow to an infinite pass and a NaN phase                                               | packages/clock/src/place.ts:16  |     1 |     1 | low      |
