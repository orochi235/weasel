# path-tools.part3: saturation

Repeated blind reviews of the area `path-tools.part3` (37 files, 3597 lines) at the frozen commit
`ca78c1c42a`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report path-tools.part3` rewrites this file from the ledger.

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

| id  | defect                                                                                                                            | where                                                          | first | codex | severity |
|-----|-----------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------|------:|------:|----------|
| D1  | Shape Builder plan cache ignores adapter identity, so a matching key in a new scene commits through the previous scene's adapter  | packages/path-tools/src/shapeBuilder/shapeBuilderActions.ts:25 |     1 |     1 | medium   |
| D2  | A throwing apply callback in outline session commit leaves converted text nodes and the history journal open                      | packages/path-tools/src/shared/outlineSession.ts:89 (commit)   |     1 |     1 | medium   |
| D3  | sameUnder ignores command kinds, so a live warp re-opens after a path's command topology changes and can restore removed segments | packages/path-tools/src/warp/pathWarp.ts:124 (sameUnder)       |     1 |     1 | medium   |
