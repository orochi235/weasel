# apps.chart.src.pipeline: saturation

Repeated blind reviews of the area `apps.chart.src.pipeline` (10 files, 713 lines) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than 1 defect per thousand lines is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: ready to fix: 12.6 known defects per thousand lines, at least 5. The next defect should cost about $0.68. `skulkr scour report apps.chart.src.pipeline` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.17 |    $0.06 |     0.1 |
|   2 | claude |        4 |   3 |        6 |   5 |   1 |       12.3 |    6.3 |    51.0% | $0.85 |    $0.17 |     1.1 |
|   3 | claude |        3 |   1 |        7 |   5 |   1 |       15.3 |    8.3 |    41.7% | $0.89 |    $0.27 |     2.0 |
|   4 | claude |        2 |   1 |        8 |   5 |   2 |       12.7 |    4.7 |    32.9% | $0.89 |    $0.35 |     1.1 |
|   5 | claude |        3 |   1 |        9 |   6 |   1 |       23.4 |   14.4 |    36.9% | $0.71 |    $0.39 |     1.7 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        3 |          – |      – |        – |       – |
| claude         | Chao2     |         4 |        7 |       13.0 |    6.0 |    28.6% |       – |
| all sources    | Chao2     |         5 |        9 |       23.4 |   14.4 |    36.9% |       – |
| codex × claude | Chapman   |         – |        9 |       15.0 |    6.0 |        – |       1 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                 | where                                                                 | first | codex | claude | severity |
|-----|----------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | Autosave persists an uncommitted slider preview, so reopening loads it as document content                                             | apps/chart/src/pipeline/usePipelineDoc.ts:58                          |     1 |     1 |      3 | medium   |
| D2  | A source-image pick resolved after unmount allocates a bitmap that is never closed, because the ticket is taken after the picker await | apps/chart/src/pipeline/pipelineRun.ts:130 (chooseImage)              |     1 |     1 |      0 | low      |
| D3  | Run and Step on an audio-only graph drive the empty image runner and never start or advance the audio graph                            | apps/chart/src/pipeline/pipelineRun.ts:69                             |     1 |     1 |      0 | low      |
| D4  | Params that share a label and have no id collide, so one edit rewrites both and React sees duplicate keys                              | apps/chart/src/pipeline/ParamPanel.tsx:77 (ParamPanel)                |     2 |     0 |      1 | low      |
| D5  | Pipeline undo history has no bound, and every step holds a whole EffectDoc                                                             | apps/chart/src/pipeline/usePipelineDoc.ts:50 (usePipelineDoc)         |     2 |     0 |      2 | low      |
| D6  | change records an undo step even when the doc did not change                                                                           | apps/chart/src/pipeline/usePipelineDoc.ts:61 (change)                 |     2 |     0 |      3 | low      |
| D7  | Editing an audio stage or a group recomputes the domain split and resets the image runner, losing its stepped pass                     | apps/chart/src/pipeline/pipelineRun.ts:56 (usePipelineRun)            |     3 |     0 |      1 | low      |
| D8  | When a later pick overtakes an earlier source-image pick, the earlier pick's decode failure is still reported                          | apps/chart/src/pipeline/pipelineRun.ts:128 (chooseImage)              |     4 |     0 |      1 | low      |
| D9  | Add Page and Delete Page stay enabled under the Rack and Lanes views, which ignore pages                                               | apps/chart/src/pipeline/pipelinePages.ts:17 (usePipelinePageCommands) |     5 |     0 |      1 | low      |
