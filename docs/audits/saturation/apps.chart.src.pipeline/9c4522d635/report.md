# apps.chart.src.pipeline: saturation

Repeated blind reviews of the area `apps.chart.src.pipeline` (10 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, or 40 occasions have run.
Not stopped yet. `skulkr saturate report apps.chart.src.pipeline` rewrites this file from the ledger.

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

| id  | defect                                                                                                                                 | where                                                    | first | codex | severity |
|-----|----------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------|------:|------:|----------|
| D1  | Autosave persists an uncommitted slider preview, so reopening loads it as document content                                             | apps/chart/src/pipeline/usePipelineDoc.ts:58             |     1 |     1 | medium   |
| D2  | A source-image pick resolved after unmount allocates a bitmap that is never closed, because the ticket is taken after the picker await | apps/chart/src/pipeline/pipelineRun.ts:130 (chooseImage) |     1 |     1 | low      |
| D3  | Run and Step on an audio-only graph drive the empty image runner and never start or advance the audio graph                            | apps/chart/src/pipeline/pipelineRun.ts:69                |     1 |     1 | low      |
