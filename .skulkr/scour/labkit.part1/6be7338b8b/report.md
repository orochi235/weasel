# labkit.part1: saturation

Repeated blind reviews of the area `labkit.part1` (32 files, 2526 lines) at the frozen commit
`6be7338b8b`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Not stopped yet. `skulkr scour report labkit.part1` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        2 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.18 |    $0.06 |     0.3 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over        | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|-------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex       | Chao2     |         1 |        3 |          – |      – |        – |       – |
| all sources | Chao2     |         1 |        3 |          – |      – |        – |       – |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                                                                                               | where                                                                   | first | codex | severity |
|-----|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------|------:|------:|----------|
| D1  | Queued setState updaters in drive and begin fold items from a canceled or superseded run because they never re-check the run token                                                                                                   | packages/labkit/src/job/useJob.ts:64 (drive)                            |     1 |     1 | medium   |
| D2  | For a lightbox portalled into a same-origin frame, the Escape listener and focus capture/restore use the global document rather than the root's owner document, so Escape is never heard and focus is restored in the wrong document | packages/labkit/src/lightbox/useLightboxModal.ts:106 (useLightboxModal) |     1 |     1 | medium   |
| D3  | The module-wide lightbox open order is shared across documents, so the latest-opened lightbox in one document decides whether a lightbox in another document may close                                                               | packages/labkit/src/lightbox/useLightboxModal.ts:106 (useLightboxModal) |     1 |     1 | medium   |
