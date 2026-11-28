# labkit.clock: saturation

Repeated blind reviews of the area `labkit.clock` (15 files, 1020 lines) at the frozen commit
`6be7338b8b`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report labkit.clock` rewrites this file from the ledger.

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

| id  | defect                                                                                                                                                | where                                                               | first | codex | severity |
|-----|-------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------|------:|------:|----------|
| D1  | Trial clock hooks call useSyncExternalStore without a server snapshot, so React server rendering throws even when the instrument has no clock         | packages/labkit/src/clock/useTrialClockSetup.ts:71 (useSeededClock) |     1 |     1 | medium   |
| D2  | An infinite held time on a non-seekable looping clock makes runTo loop forever and block the thread                                                   | packages/labkit/src/clock/runTo.ts:14 (runTo)                       |     1 |     1 | high     |
| D3  | toggle uses the playing value captured when the control was made, so two toggles before a rerender repeat play or pause instead of undoing each other | packages/labkit/src/clock/transportControl.ts:86 (toggle)           |     1 |     1 | medium   |
