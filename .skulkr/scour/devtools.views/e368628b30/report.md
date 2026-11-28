# devtools.views: saturation

Repeated blind reviews of the area `devtools.views` (40 files) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report devtools.views` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.17 |    $0.06 |     0.2 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        3 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        3 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                                 | where                                            | first | codex | severity |
|-----|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------|------:|------:|----------|
| D1  | An older scene-tree response can overwrite the latest level; no per-parent request generation, so a delayed success replaces newer rows and a delayed child error collapses the branch | packages/devtools/src/views/useSceneTree.ts:33   |     1 |     1 | medium   |
| D2  | A truncated array is labeled with its preview length (Array(101)) instead of the real length from the truncation marker                                                                | packages/devtools/src/views/ValueView.tsx:40     |     1 |     1 | low      |
| D3  | A synchronous throw from a query callback leaves busy set and done never called, so coalesced reads are permanently wedged                                                             | packages/devtools/src/views/coalesced.ts:15 (go) |     1 |     1 | low      |
