# forge.shell.loupe: saturation

Repeated blind reviews of the area `forge.shell.loupe` (19 files) at the frozen commit
`e368628b30`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, or 40 occasions have run.
Not stopped yet. `skulkr saturate report forge.shell.loupe` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   2 |        2 |   2 |   0 |          – |      – |        – | $0.17 |    $0.08 |     0.1 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        2 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        2 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                                                 | where                                                | first | codex | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------|------:|------:|----------|
| D1  | Recursive undefined-stripping overflows on cyclic story state/config before the guarded JSON check, bypassing STATE_UNSENDABLE/CONFIG_UNSENDABLE and throwing outside the lens's request error handler | packages/forge/src/shell/loupe/capturePayload.ts:88  |     1 |     1 | medium   |
| D2  | Capture payload omits the story's declared globals, so Pixels capture runs under different host conditions (e.g. light vs dark mode) than Live                                                         | packages/forge/src/shell/loupe/capturePayload.ts:125 |     1 |     1 | medium   |
