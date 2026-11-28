# renderer.shaders: saturation

Repeated blind reviews of the area `renderer.shaders` (18 files, 2068 lines) at the frozen commit
`0269be874a`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report renderer.shaders` rewrites this file from the ledger.

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

| id  | defect                                                                                                                                      | where                                                    | first | codex | severity |
|-----|---------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------|------:|------:|----------|
| D1  | ID injection's collision check omits weasel_main, so a shader already defining that helper gets a duplicate definition and fails to compile | packages/renderer/src/shaders/idOutput.ts:58             |     1 |     1 | medium   |
| D2  | pickId 0 passes validation and is written with opaque alpha, overwriting an earlier positive ID with the no-claim value                     | packages/renderer/src/shaders/idOutput.ts:74             |     1 |     1 | medium   |
| D3  | conditional struct redefinitions merge members by name, dropping a later branch's larger array slots from uniform lookup                    | packages/renderer/src/shaders/extractUniformNames.ts:214 |     1 |     1 | low      |
